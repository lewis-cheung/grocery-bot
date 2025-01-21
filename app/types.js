import { Context } from 'telegram-commander'

/**
 * @typedef {import('./models/index.js').User} User
 * 
 * @typedef {Context & { user: User }} ContextWithUser
 */

/**
 * @enum {string}
 */
export const Env = {
  DEVELOPMENT: 'development',
  UAT: 'uat',
  PRODUCTION: 'production',
}