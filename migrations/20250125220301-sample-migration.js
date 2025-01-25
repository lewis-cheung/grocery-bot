export const up = async (db, client) => {
    await db.collection('sample').insertOne({ name: 'sample' })
}

export const down = async (db, client) => {
  await db.collection('sample').deleteOne({ name: 'sample' })
}
