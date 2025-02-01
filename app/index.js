import { TelegramCommander, escapeMarkdownV2 as e } from 'telegram-commander'
import mongoose from 'mongoose'

import { User, GroceryItem, GroceryItemUnit, displayUnitByUnit } from './models/index.js'
import config from '../config.js'
import logger from './logger.js'
import * as types from './types.js'

export default class TelegramCommanderApp extends TelegramCommander {

  /** @type {number[]} */           notiChatIds = config.telegram.notiChatIds

  constructor() {
    if (config.telegram.token === undefined) {
      logger.error('Telegram token is not set in config.yaml')
      process.exit(1)
    }

    super(config.telegram.token, {
      logger,
      whitelistedChatIds: config.telegram.whitelistedChatIds,
    })

    // Add user to context before handling command
    this.beforeHandleCommandHooks.push(async (ctx) => {
      ctx.user = await User.getUserByChatId(ctx.chatId, { createIfNotFound: true, updateLastCommandAt: true })
    })
  }

  /**
   * Initialize commands
   */
  async initCommands() {
    await this.addCommand({
      name: 'add_item',
      description: 'Add grocery item to list',
      handler: this.handleAddItemCmd.bind(this),
    })

    await this.addCommand({
      name: 'remove_item',
      description: 'Remove grocery item from list',
      handler: this.handleRemoveItemCmd.bind(this),
    })

    await this.addCommand({
      name: 'show_list',
      description: 'Show grocery list',
      handler: this.handleShowListCmd.bind(this),
    })

    await this.addCommand({
      name: 'record_purchase',
      description: 'Record a purchase',
      handler: this.handleRecordPurchaseCmd.bind(this),
    })

    await this.syncCommands()
  }

  /**
   * Initialize MongoDB connection
   * @param {string} fullUri - MongoDB full uri (e.g. mongodb+srv://user:pass@dev-cluster.abcde.mongodb.net)
   * @param {string} dbName - MongoDB database name
   */
  async initMongo(fullUri, dbName) {
    try {
      await mongoose.connect(fullUri, {
        dbName,
      })
      // mask password in log
      const uriWithoutPassword = fullUri.replace(/\/(.+):(.+)@/, '/$1:****@')
      logger.info(`Connected to database at ${uriWithoutPassword}.`)
    } catch (error) {
      logger.error('Failed to connect to database.', error)
      process.exit(1)
    }
  }

  /**
   * Start the application
   */
  async start() {
    if (config.mongo?.fullUri !== undefined) {
      await this.initMongo(config.mongo.fullUri, config.mongo.dbName)
    } else {
      logger.warn('mongo.fullUri is not set in config.yaml, skipping database connection. If this is intentional, remove initMongo() from index.js.')
    }
    await this.initCommands()
    await this.notify(e(`${config.appName} started.`))
  }

  /**
   * Send message to notification chat ids
   * @param {string|string[]} content
   */
  async notify(content) {
    await this.sendMessage(this.notiChatIds, content)
  }

  /**
   * 
   * @param {types.ContextWithUser} ctx
   * @param {GroceryItem[]} suggestedItems
   * @param {Object} [opts={}]
   * @param {string} [opts.isManualInputEnabled=true]
   * @returns 
   */
  async promptGroceryItem(ctx, suggestedItems = [], opts = {}) {
    // options
    const { isManualInputEnabled = true } = opts

    // prompt for name
    const keyboardColumnSize = 2
    const suggestionRows = []
    for (let i = 0; i < suggestedItems.length; i += keyboardColumnSize) {
        const chunk = suggestedItems.slice(i, i + keyboardColumnSize)
        suggestionRows.push(chunk.map((item) => ({ text: item.name, callback_data: item.name })))
    }
    const inputName = await ctx.prompt(e('Select or enter a grocery item:'), {
      isManualInputEnabled,
      promptTextOnDone: (value) => `Grocery item: ${value}`,
      reply_markup: {
        inline_keyboard: suggestionRows,
      },
    })

    // find item by name
    let groceryItem = undefined
    const searchResult = await GroceryItem.searchByName(ctx.user._id, inputName)
    console.log(searchResult)
    if (searchResult.isExactMatch) {
      groceryItem = searchResult.items[0]
    } else if (searchResult.items.length > 0) {
      // prompt for confirmation to select the correct item
      const suggestionRows = []
      for (let i = 0; i < searchResult.items.length; i += keyboardColumnSize) {
        const chunk = searchResult.items.slice(i, i + keyboardColumnSize)
        suggestionRows.push(chunk.map((item) => ({ text: item.name, callback_data: item.name })))
      }
      let finalItemName = await ctx.prompt(e('Are you referring to one of the following items?'), {
        reply_markup: {
          inline_keyboard: [
            ...suggestionRows,
            [{ text: 'No, this is a new item', callback_data: inputName }],
          ],
        },
        promptTextOnDone: (value) => `Selected item: ${value}`,
      })
      groceryItem = searchResult.items.find((item) => item.name === finalItemName)
    }
    if (!groceryItem) {
      // item does not exist, prompt for unit and create new item
      const unit = await ctx.prompt(e('Unit for this new item:'), {
        reply_markup: {
          inline_keyboard: [
            Object.values(GroceryItemUnit).splice(0, 5).map((unit) => ({ text: displayUnitByUnit[unit], callback_data: unit })),
            Object.values(GroceryItemUnit).splice(5).map((unit) => ({ text: displayUnitByUnit[unit], callback_data: unit })),
          ],
        },
        validator: (value) => Object.values(GroceryItemUnit).includes(value),
        errorMsg: e('Please enter a valid unit.'),
        promptTextOnDone: (value) => `Unit for this new item: ${displayUnitByUnit[value]}`,
      })

      groceryItem = await GroceryItem.create(ctx.user._id, inputName, unit)
      await ctx.reply(e(`New grocery item ${groceryItem.name} created.`))
    }

    return groceryItem
  }

  /**
   * Handle add grocery item command
   * @param {types.ContextWithUser} ctx - The context
   */
  async handleAddItemCmd(ctx) {
    const groceryItem = await this.promptGroceryItem(ctx)
    if (groceryItem.isPendingForPurchase()) {
      await ctx.reply(e(`Grocery item ${groceryItem.name} already in list.`))
      return
    }

    // Prompt for quantity
    const quantity = await ctx.prompt(e(`Quantity (${groceryItem.unit}):`), {
      reply_markup: { inline_keyboard: [[{ text: 'Skip', callback_data: '0' }]] },
      validator: (value) => !isNaN(Number(value)) && Number(value) >= -1,
      errorMsg: 'Please enter a valid positive number or 0 to skip.',
      promptTextOnDone: (value) => value === '0' ? 'Quantity not specified.' : `Quantity: ${value}`,
    })
    const quantityNum = quantity === '0' ? undefined : Number(quantity)

    await groceryItem.setPendingPurchase(quantityNum)
    await ctx.reply(e(`Grocery item ${groceryItem.name} added.`))
  }

  /**
   * Handle remove grocery item command
   * @param {types.ContextWithUser} ctx - The context
   */
  async handleRemoveItemCmd(ctx) {
    const pendingPurchaseItems = await GroceryItem.getAllWithPendingPurchase(ctx.user._id)
    const groceryItem = await this.promptGroceryItem(ctx, pendingPurchaseItems, { isManualInputEnabled: false })
    if (!groceryItem.isPendingForPurchase()) {
      await ctx.reply(e(`Grocery item ${groceryItem.name} is not in list.`))
      return
    }
    await groceryItem.unsetPendingPurchase()
    await ctx.reply(e(`Grocery item ${groceryItem.name} removed from list.`))
  }

  /**
   * Handle show list command
   * @param {types.ContextWithUser} ctx - The context
   */
  async handleShowListCmd(ctx) {
    const groceryItems = await GroceryItem.getAllWithPendingPurchase(ctx.user._id)
    const listMsg = groceryItems.map((item) => {
      let msg = `*${item.name}*`
      if (item.pendingPurchase.quantity !== undefined) {
        msg += e(` - ${item.pendingPurchase.quantity}${item.displayUnit}`)
      }
      if (item.purchases.length > 0) {
        const { avgPrice, denominator } = item.getPriceSummary()
        msg += e(` (avg: $${avgPrice.toFixed(2)}/${denominator}${item.displayUnit})`)
      }
      return msg
    }).join('\n')
    await ctx.reply([ e(`Grocery list:`), listMsg ])
  }

  /**
   * Handle record purchase command
   * @param {types.ContextWithUser} ctx - The context
   */
  async handleRecordPurchaseCmd(ctx) {
    const pendingPurchaseItems = await GroceryItem.getAllWithPendingPurchase(ctx.user._id)
    const groceryItem = await this.promptGroceryItem(ctx, pendingPurchaseItems)

    // prompt for quantity
    // TODO: check against pending purchase quantity
    const quantity = await ctx.prompt(e(`Quantity (${groceryItem.displayUnit}): `), {
      validator: (value) => !isNaN(Number(value)) && Number(value) >= -1,
      errorMsg: 'Please enter a valid positive number or 0 to skip.',
      promptTextOnDone: (value) => `Quantity (${groceryItem.displayUnit}): ${value}`,
    })
    const quantityNum = Number(quantity)

    // prompt for price
    const price = await ctx.prompt(e('Enter total price:'), {
      validator: (value) => !isNaN(Number(value)) && Number(value) >= 0,
      errorMsg: 'Please enter a valid positive number.',
      promptTextOnDone: (value) => `Total Price: ${value}`,
    })
    const priceNum = Number(price)
    
    await groceryItem.recordPurchase(quantityNum, priceNum)
    const { avgPrice, denominator } = GroceryItem.calculateAvgPrice(priceNum, quantityNum, groceryItem.unit)
    await ctx.reply(e(`Purchase of ${quantityNum} ${groceryItem.displayUnit} of ${groceryItem.name} at $${priceNum} ($${avgPrice.toFixed(2)}/${denominator}${groceryItem.displayUnit}) recorded.`))
  }
}


