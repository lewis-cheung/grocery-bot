import mongoose from 'mongoose'

/**
 * @enum {string}
 */
const UserStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
}

const userSchema = new mongoose.Schema({
  chatId: { type: Number, required: true },
  status: { type: String, required: true, enum: Object.values(UserStatus) },
  lastCommandAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
})
userSchema.index({ chatId: 1 }, { unique: true })

class User extends mongoose.model('User', userSchema) {
  /**
   * Get a user by chatId
   * @param {Number} chatId
   * @param {Object} [opts={}]
   * @param {boolean} [opts.createIfNotFound=false] - Create a new user if not found
   * @param {boolean} [opts.updateLastCommandAt=true] - Update the lastCommandAt field
   * @returns {Promise<User>}
   */
  static async getUserByChatId(chatId, opts = {}) {
    opts = {
      createIfNotFound: false,
      updateLastCommandAt: true,
      ...opts,
    }

    let user = await this.findOne({ chatId })
    let isUpdated = false
    if (opts.createIfNotFound && !user) {
      user = new User({ chatId, status: UserStatus.ACTIVE })
      isUpdated = true
    }
    if (opts.updateLastCommandAt) {
      user.lastCommandAt = new Date()
      isUpdated = true
    }
    if (isUpdated) {
      await user.save()
    }
    return user
  }
}

export {
  User,
  UserStatus,
  userSchema,
}
