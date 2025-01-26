import mongoose from 'mongoose'
import Fuse from 'fuse.js'

import { escapeRegex } from '../helpers/index.js'

/**
 * @typedef {object} PriceSummary
 * @property {number} avgPrice - The average price
 * @property {number} denominator - The denominator
 * 
 * @typedef {object} GroceryItemSearchResult
 * @property {GroceryItem[]} items - The grocery items
 * @property {boolean} isExactMatch - Whether the item is an exact match
 */

/** @enum {string} */
const GroceryItemUnit = {
  KG: 'kg',
  G: 'g',
  LB: 'lb',
  ML: 'ml',
  L: 'l',
  PIECE: 'piece',
  PACK: 'pack',
  CAN: 'can',
  BOTTLE: 'bottle',
  USE: 'use',
}

/**
 * Display text of units
 * @type {Record<GroceryItemUnit, string>}
 */
const displayUnitByUnit = {
  [GroceryItemUnit.KG]: 'kg',
  [GroceryItemUnit.G]: 'g',
  [GroceryItemUnit.LB]: 'lb',
  [GroceryItemUnit.ML]: 'ml',
  [GroceryItemUnit.L]: 'L',
  [GroceryItemUnit.PIECE]: ' piece(s)',
  [GroceryItemUnit.PACK]: ' pack(s)',
  [GroceryItemUnit.CAN]: ' can(s)',
  [GroceryItemUnit.BOTTLE]: ' bottle(s)',
  [GroceryItemUnit.USE]: ' use(s)',
}

/**
 * Denominator when averaging the price. E.g. If unit is 'g' and averageDenominator is 100, then its average price will be displayed as $x/100g.
 * @type {Record<GroceryItemUnit, number>}
 */
const avgDenominatorByUnit = {
  [GroceryItemUnit.KG]: 1,
  [GroceryItemUnit.G]: 100,
  [GroceryItemUnit.LB]: 1,
  [GroceryItemUnit.ML]: 100,
  [GroceryItemUnit.L]: 1,
  [GroceryItemUnit.PIECE]: 1,
  [GroceryItemUnit.PACK]: 1,
  [GroceryItemUnit.CAN]: 1,
  [GroceryItemUnit.BOTTLE]: 1,
  [GroceryItemUnit.USE]: 1,
}

const groceryItemSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  name: { type: String, required: true },
  unit: { type: String, enum: Object.values(GroceryItemUnit), required: true },
  pendingPurchase: {
    requestedAt: { type: Date },
    quantity: { type: Number },
  },
  purchases: [{
    purchasedAt: { type: Date },
    quantity: { type: Number },
    price: { type: Number },
  }],
}, {
  timestamps: true,
})
groceryItemSchema.index({ user: 1, name: 1 }, { unique: true })

class GroceryItem extends mongoose.model('GroceryItem', groceryItemSchema) {

  /**
   * Get for grocery items by name
   * @param {mongoose.Types.ObjectId} userId - The ID of the user
   * @param {string} name - The name of the grocery item
   * @returns {Promise<GroceryItemSearchResult>} - A promise that resolves to an array of grocery items. Only one item is returned if exact match is found.
   */
  static async searchByName(userId, name) {
    // check if exact match exists (case insensitive)
    const caseInsensitiveRegex = new RegExp(`^${escapeRegex(name)}$`, 'i')
    const exactMatches = await this.find({ user: userId, name: caseInsensitiveRegex })
    if (exactMatches.length === 1) {
      return {
        items: exactMatches,
        isExactMatch: true,
      }
    } else if (exactMatches.length > 1) {
      return {
        items: exactMatches,
        isExactMatch: false,
      }
    }

    // fuzzy search
    const allItems = await this.find({ user: userId }).limit(1000)
    const fuse = new Fuse(allItems, {
      keys: ['name'],
      threshold: 0.5,
      ignoreLocation: true,
      isCaseSensitive: false,
      shouldSort: true,
    })
    const searchResults = fuse.search(name).slice(0, 10)
    return {
      items: searchResults.map((result) => result.item),
      isExactMatch: false,
    }
  }

  /**
   * Create a new grocery item
   * @param {mongoose.Types.ObjectId} userId - The ID of the user
   * @param {string} name - The name of the grocery item
   * @param {Object} opts - Options
   * @param {Object} opts.pendingPurchase - The pending purchase
   * @param {number} opts.pendingPurchase.quantity - The quantity of the item requested
   * @returns {Promise<GroceryItem>} - A promise that resolves to the new grocery item
   */
  static async create(userId, name, unit, opts = {}) {
    const pendingPurchase = opts?.pendingPurchase
    if (pendingPurchase) {
      pendingPurchase.requestedAt = Date.now()
    }

    const groceryItem = new GroceryItem({
      user: userId,
      name,
      unit,
      pendingPurchase,
      purchases: [],
    })
    await groceryItem.save()
    return groceryItem
  }

  /**
   * Get all grocery items with a pending purchase
   * @param {mongoose.Types.ObjectId} userId - The ID of the user
   * @returns {Promise<GroceryItem[]>} - A promise that resolves to an array of grocery items
   */
  static async getAllWithPendingPurchase(userId) {
    return this.find({
      user: userId,
      'pendingPurchase': { $exists: true, $ne: undefined },
    })
  }

  /**
   * Calculate the average price of a grocery item
   * @param {number} price - The price of the item
   * @param {number} quantity - The quantity of the item
   * @param {string} unit - The unit of the item
   * @returns {{avgPrice: number, denominator: number}} - The average price and denominator
   */
  static calculateAvgPrice(price, quantity, unit) {
    const denominator = avgDenominatorByUnit[unit]
    return {
      avgPrice: quantity === 0 ? 0 : price / quantity * denominator,
      denominator,
    }
  }

  /**
   * Set the pending purchase for a grocery item
   * @param {number} quantity - The quantity of the item requested
   */
  async setPendingPurchase(quantity) {
    this.pendingPurchase = { quantity, requestedAt: Date.now() }
    await this.save()
  }

  /**
   * Record a purchase for a grocery item
   * @param {number} quantity - The quantity of the item purchased
   * @param {number} price - The price of the item purchased
   */
  async recordPurchase(quantity, price) {
    this.purchases.push({ quantity, price, purchasedAt: Date.now() })
    this.pendingPurchase = undefined
    await this.save()
  }

  /**
   * Get the display unit of the grocery item
   * @returns {string} - The display unit
   */
  get displayUnit() {
    return displayUnitByUnit[this.unit]
  }

  /**
   * Get the price summary of the grocery item
   * @returns {PriceSummary} - The price summary
   */
  getPriceSummary() {
    const totalPrice = this.purchases.reduce((acc, purchase) => acc + purchase.price, 0)
    const totalQuantity = this.purchases.reduce((acc, purchase) => acc + purchase.quantity, 0)
    return {
      ...GroceryItem.calculateAvgPrice(totalPrice, totalQuantity, this.unit),
    }
  }

  /**
   * Check if the grocery item is pending for purchase
   * @returns {boolean} - Whether the grocery item is pending for purchase
   */
  isPendingForPurchase() {
    return this.pendingPurchase?.requestedAt !== undefined
  }
}

export {
  GroceryItem,
  GroceryItemUnit,
  avgDenominatorByUnit,
  displayUnitByUnit,
}
