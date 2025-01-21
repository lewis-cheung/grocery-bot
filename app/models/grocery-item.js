import mongoose from 'mongoose'

import { escapeRegex } from '../helpers/index.js'

const GroceryItemUnit = {
  PIECE: 'piece',
  KG: 'kg',
  G: 'g',
  ML: 'ml',
  L: 'l',
  PACK: 'pack',
}

const groceryItemSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  name: { type: String, required: true },
  pendingPurchase: {
    isPending: { type: Boolean, default: false },
    requestedAt: { type: Date, required: true, default: Date.now },
    quantity: { type: Number },
    unit: { type: String, enum: Object.values(GroceryItemUnit) },
  },
  purchaseRecords: [{
    purchasedAt: { type: Date, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true, enum: Object.values(GroceryItemUnit) },
  }],
  // TODO: average price, highest price, lowest price
}, {
  timestamps: true,
})
groceryItemSchema.index({ name: 1, user: 1 }, { unique: true })

class GroceryItem extends mongoose.model('GroceryItem', groceryItemSchema) {

  /**
   * Search for grocery items by name
   * @param {mongoose.Types.ObjectId} userId - The ID of the user
   * @param {string} name - The name of the grocery item
   * @returns {Promise<GroceryItem[]>} - A promise that resolves to an array of grocery items
   */
  static async searchByName(userId, name) {
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
   * @param {boolean} opts.pendingPurchase.isPending - Whether the item is pending purchase
   * @param {number} opts.pendingPurchase.quantity - The quantity of the item requested
   * @param {string} opts.pendingPurchase.unit - The unit of the item requested
   * @returns {Promise<GroceryItem>} - A promise that resolves to the new grocery item
   */
  static async create(userId, name, opts = {}) {
    const groceryItem = new GroceryItem({
      user: userId,
      name,
      pendingPurchase: opts?.pendingPurchase,
      purchaseRecords: [],
    })
    await groceryItem.save()
    return groceryItem
  }
}

export {
  GroceryItem,
  GroceryItemUnit,
}