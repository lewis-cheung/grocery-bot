import { TelegramCommander, escapeMarkdownV2 as e } from 'telegram-commander'
import mongoose from 'mongoose'

import { User, GroceryItem, GroceryItemUnit } from './models/index.js'
import config from './config.js'
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
   * Handle add grocery item command
   * @param {types.ContextWithUser} ctx - The context
   */
  async handleAddItemCmd(ctx) {
    // Prompt for name
    // TODO: give some name suggestions
    // TODO: already in list
    const name = await ctx.prompt(e('Select or enter a grocery item to add:'), {
      promptTextOnDone: (value) => `Grocery item: ${value}`,
    })

    // Prompt for quantity
    const quantity = await ctx.prompt(e('Quantity: (Enter number or skip)'), {
      reply_markup: { inline_keyboard: [[{ text: 'Skip', callback_data: '0' }]] },
      validator: (value) => !isNaN(Number(value)) && Number(value) >= -1,
      errorMsg: 'Please enter a valid positive number or 0 to skip.',
      promptTextOnDone: (value) => value === '0' ? 'Quantity not specified.' : `Quantity: ${value}`,
    })
    const quantityNum = quantity === '0' ? undefined : Number(quantity)

    // Prompt for unit if quantity is specified
    /** @type {GroceryItemUnit} */
    let unit = undefined
    if (quantityNum > 0) {
      unit = await ctx.prompt(e('Unit:'), {
        reply_markup: {
          inline_keyboard: [
            Object.values(GroceryItemUnit).splice(0, 5).map((unit) => ({ text: unit, callback_data: unit })),
            Object.values(GroceryItemUnit).splice(5).map((unit) => ({ text: unit, callback_data: unit })),
          ],
        },
        validator: (value) => Object.values(GroceryItemUnit).includes(value),
        errorMsg: e('Please enter a valid unit.'),
        promptTextOnDone: (value) => `Unit: ${value}`,
      })
    }

    const groceryItem = await GroceryItem.addPendingPurchase(ctx.user._id, name, quantityNum, unit)
    await ctx.reply(e(`Grocery item ${groceryItem.name} added.`))
  }

  /**
   * Handle show list command
   * @param {types.ContextWithUser} ctx - The context
   */
  async handleShowListCmd(ctx) {
    const groceryItems = await GroceryItem.getAllWithPendingPurchase(ctx.user._id)
    const listMsg = groceryItems.map((item) => {
      let msg = `*${item.name}*`
      if (item.pendingPurchase?.quantity) {
        const quantity = item.pendingPurchase.quantity
        const unit = item.pendingPurchase.unit
        msg += e(` - ${quantity} ${unit}(s)`)
      }
      if (item.purchases.length > 0) {
        // TODO: handle multiple units
        const totalPrice = item.purchases.reduce((acc, purchase) => acc + purchase.price, 0)
        const avgPrice = totalPrice / item.purchases.length
        msg += e(` (avg: $${avgPrice.toFixed(2)}/${item.purchases[0].unit})`)
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
    const itemName = await ctx.prompt(e('Select or enter a grocery item name:'), {
      reply_markup: {
        inline_keyboard: pendingPurchaseItems.map((item) => ([{ text: item.name, callback_data: item.name }])),
      },
      promptTextOnDone: (value) => `Grocery item: ${value}`,
    })

    // find item by name
    let groceryItem = undefined
    const searchResults = await GroceryItem.getSimilarByName(ctx.user._id, itemName)
    if (searchResults.length === 1) {
      groceryItem = searchResults[0]
    } else if (searchResults.length > 1) {
      // prompt for confirmation to select the correct item
      let finalItemName = await ctx.prompt(e('Are you referring to one of the following items?'), {
        reply_markup: {
          inline_keyboard: [
            ...searchResults.map((item) => ([{ text: item.name, callback_data: item.name }])),
            [{ text: 'No, this is a new item', callback_data: itemName }],
          ],
        },
      })
      groceryItem = searchResults.find((item) => item.name === finalItemName)
    }
    if (!groceryItem) {
      groceryItem = await GroceryItem.create(ctx.user._id, itemName)
      await ctx.reply(e(`New grocery item ${groceryItem.name} created.`))
    }

    // prompt for quantity
    // TODO: check against pending purchase quantity
    const quantity = await ctx.prompt(e('Quantity:'), {
      validator: (value) => !isNaN(Number(value)) && Number(value) >= -1,
      errorMsg: 'Please enter a valid positive number or 0 to skip.',
      promptTextOnDone: (value) => `Quantity: ${value}`,
    })
    const quantityNum = Number(quantity)

    // prompt for unit
    const unit = await ctx.prompt(e('Select unit:'), {
      reply_markup: {
        inline_keyboard: [
          Object.values(GroceryItemUnit).splice(0, 5).map((unit) => ({ text: unit, callback_data: unit })),
          Object.values(GroceryItemUnit).splice(5).map((unit) => ({ text: unit, callback_data: unit })),
        ],
      },
      validator: (value) => Object.values(GroceryItemUnit).includes(value),
      errorMsg: 'Please enter a valid unit.',
      promptTextOnDone: (value) => `Unit: ${value}`,
    })

    // prompt for price
    const price = await ctx.prompt(e('Enter total price:'), {
      validator: (value) => !isNaN(Number(value)) && Number(value) >= 0,
      errorMsg: 'Please enter a valid positive number.',
      promptTextOnDone: (value) => `Total Price: ${value}`,
    })
    const priceNum = Number(price)
    
    await groceryItem.recordPurchase(quantityNum, unit, priceNum)
    const unitPrice = priceNum / quantityNum
    await ctx.reply(e(`Purchase of ${quantityNum} ${unit}(s) of ${groceryItem.name} at $${priceNum} ($${unitPrice.toFixed(2)}/${unit}) recorded.`))
  }
}


