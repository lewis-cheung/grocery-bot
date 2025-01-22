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
      name: 'add_to_list',
      description: 'Add grocery item to list',
      handler: this.handleAddToList.bind(this),
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
  async handleAddToList(ctx) {
    // Prompt for name
    // TODO: give some name suggestions
    // TODO: already in list
    const name = await ctx.prompt(e('Grocery item to add:'))

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
            Object.values(GroceryItemUnit).map((unit) => ({ text: unit, callback_data: unit })),
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
}
