import fs from 'fs'
import yaml from 'js-yaml'
import dot from 'dot-object'

import { Env } from './app/types.js'

// load the configs from the config file
const configPath = './config.yaml'
const yamlObj = yaml.load(fs.readFileSync(configPath, 'utf8'))

export default {
  appName: validateString(yamlObj, 'appName', 'unnamed app'),
  env: validateEnum(yamlObj, 'env', Object.values(Env), 'development'),
  logDir: validateString(yamlObj, 'logDir', './logs'),

  telegram: {
    token: validateString(yamlObj, 'telegram.token'),
    whitelistedChatIds: validateArray(yamlObj, 'telegram.whitelistedChatIds', undefined),
    notiChatIds: validateArray(yamlObj, 'telegram.notiChatIds', []),
  },

  mongo: {
    fullUri: validateString(yamlObj, 'mongo.fullUri', undefined),
    dbName: validateString(yamlObj, 'mongo.dbName', 'dev-db'),
  },
}

/**
 * @template T
 * @param {object} obj
 * @param {string} dotPath
 * @param {T} defaultVal
 * @returns {T}
 */
function applyDefaultVal(obj, dotPath, defaultVal = null) {
  const val = dot.pick(dotPath, obj)
  if (val === undefined) {
    if (defaultVal === null) {
      throw new Error(`config.yaml: ${dotPath} not found`)
    }
    console.warn(`config.yaml: ${dotPath} not found, using default value: ${defaultVal}`)
    return defaultVal
  }
  return val
}

/**
 * @param {object} obj
 * @param {string} dotPath
 * @param {string} defaultVal
 * @returns {string}
 */
function validateString(obj, dotPath, defaultVal) {
  const val = applyDefaultVal(obj, dotPath, defaultVal)
  if (typeof val !== 'string') {
    throw new Error(`config.yaml: ${dotPath} must be a string`)
  }
  return val
}

/**
 * @param {object} obj
 * @param {string} dotPath
 * @param {number} defaultVal
 * @returns {number}
 */
function validateNumber(obj, dotPath, defaultVal) {
  const val = applyDefaultVal(obj, dotPath, defaultVal)
  if (typeof val !== 'number') {
    throw new Error(`config.yaml: ${dotPath} must be a number`)
  }
  return val
}

/**
 * @template T
 * @param {Array<T>} obj
 * @param {string} dotPath
 * @param {Array<T>} defaultVal 
 * @returns {Array<T>}
 */
function validateArray(obj, dotPath, defaultVal) {
  const val = applyDefaultVal(obj, dotPath, defaultVal)
  if (!Array.isArray(val)) {
    throw new Error(`config.yaml: ${dotPath} must be an array`)
  }
  return val
}

/**
 * @template T
 * @param {object} obj
 * @param {string} dotPath
 * @param {T} defaultVal
 * @param {T[]} values
 * @returns {T}
 */
function validateEnum(obj, dotPath, values, defaultVal) {
  const val = applyDefaultVal(obj, dotPath, defaultVal)
  if (!values.includes(val)) {
    throw new Error(`config.yaml: ${dotPath} must be one of: ${values.join(', ')}`)
  }
  return val
}