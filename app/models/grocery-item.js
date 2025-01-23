import mongoose from 'mongoose'

import { escapeRegex } from '../helpers/index.js'

/** @enum {string} */
const GroceryItemUnit = {
  PIECES: 'pieces',
  KG: 'kg',
  G: 'g',
  ML: 'ml',
  L: 'l',
  PACKS: 'packs',
}

const groceryItemSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  name: { type: String, required: true },
  pendingPurchase: {
    requestedAt: { type: Date, required: true, default: Date.now },
    quantity: { type: Number },
    unit: { type: String, enum: Object.values(GroceryItemUnit) },
  },
  purchaseRecords: [{
    purchasedAt: { type: Date },
    quantity: { type: Number },
    unit: { type: String, enum: Object.values(GroceryItemUnit) },
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
   * @returns {Promise<GroceryItem[]>} - A promise that resolves to an array of grocery items
   */
  static async getSimilarByName(userId, name) {
    // TODO: use fuzzy search
    const regex = new RegExp(escapeRegex(name), 'i')
    return this.find({ user: userId, name: regex })
  }

  /**
   * Add a pending purchase to a grocery item. Create a new grocery item if it doesn't exist.
   * @param {mongoose.Types.ObjectId} userId - The ID of the user
   * @param {string} name - The name of the grocery item
   * @param {number} quantity - The quantity of the item requested
   * @param {string} unit - The unit of the item requested
   * @returns {Promise<GroceryItem>} - A promise that resolves to the grocery item
   */
  static async addPendingPurchase(userId, name, quantity = undefined, unit = undefined) {
    let groceryItem = await this.findOne({ user: userId, name })
    if (!groceryItem) {
      groceryItem = await this.create(userId, name, { pendingPurchase: { quantity, unit } })
    } else {
      groceryItem.pendingPurchase = { quantity, unit }
      await groceryItem.save()
    }
    return groceryItem
  }

  /**
   * Create a new grocery item
   * @param {mongoose.Types.ObjectId} userId - The ID of the user
   * @param {string} name - The name of the grocery item
   * @param {Object} opts - Options
   * @param {Object} opts.pendingPurchase - The pending purchase
   * @param {number} opts.pendingPurchase.quantity - The quantity of the item requested
   * @param {string} opts.pendingPurchase.unit - The unit of the item requested
   * @returns {Promise<GroceryItem>} - A promise that resolves to the new grocery item
   */
  static async create(userId, name, opts = {}) {
    const pendingPurchase = opts?.pendingPurchase
    if (pendingPurchase) {
      pendingPurchase.requestedAt = Date.now()
    }

    const groceryItem = new GroceryItem({
      user: userId,
      name,
      pendingPurchase,
      purchaseRecords: [],
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
}

export {
  GroceryItem,
  GroceryItemUnit,
}