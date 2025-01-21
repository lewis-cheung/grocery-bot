import { TelegramCommander, escapeMarkdownV2 as e, Context } from 'telegram-commander'
import mongoose from 'mongoose'

import { User } from './models/index.js'
import config from './config.js'
import logger from './logger.js'

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
      name: 'sample',
      description: 'Sample command',
      handler: async (ctx) => {
        await ctx.reply(`chatId: ${ctx.chatId}`)
      }
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
}
