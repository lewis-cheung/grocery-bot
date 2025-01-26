import mongoose from 'mongoose'

import { escapeRegex } from '../helpers/index.js'

/**
 * @typedef {object} PriceSummary
 * @property {number} avgPrice - The average price
 * @property {number} denominator - The denominator
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
  [GroceryItemUnit.PIECE]: 'piece(s)',
  [GroceryItemUnit.PACK]: 'pack(s)',
  [GroceryItemUnit.CAN]: 'can(s)',
  [GroceryItemUnit.BOTTLE]: 'bottle(s)',
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
  // TODO: average price, highest price, lowest price
}, {
  timestamps: true,
})
groceryItemSchema.index({ name: 1, user: 1 }, { unique: true })

class GroceryItem extends mongoose.model('GroceryItem', groceryItemSchema) {

  /**
   * Get for grocery items by name
   * @param {mongoose.Types.ObjectId} userId - The ID of the user
   * @param {string} name - The name of the grocery item
   * @returns {Promise<GroceryItem[]>} - A promise that resolves to an array of grocery items. Only one item is returned if exact match is found.
   */
  static async getSimilarByName(userId, name) {
    const exactMatch = await this.findOne({ user: userId, name })
    if (exactMatch) {
      return [exactMatch]
    }

    // TODO: use fuzzy search
    const regex = new RegExp(escapeRegex(name), 'i')
    return this.find({ user: userId, name: regex })
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
