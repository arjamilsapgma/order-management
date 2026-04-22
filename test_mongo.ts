import { MongoClient } from 'mongodb';

async function testDateParsing() {
  const client = await MongoClient.connect('mongodb://120.50.3.13:27017/admin');
  const db = client.db();
  
  const result = await db.collection('orders_management').aggregate([
    { $limit: 10 },
    { $project: { OrderDate: 1, parsed: { $convert: { input: "$OrderDate", to: "date", onError: null, onNull: null } } } }
  ]).toArray();
  
  console.log(result);
  await client.close();
}
testDateParsing();
