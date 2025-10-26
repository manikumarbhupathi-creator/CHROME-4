const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const mongoURI = 'mongodb://localhost:27017/time_tracker';

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB connected"))
.catch(err => console.error(err));

const TimeEntrySchema = new mongoose.Schema({
  userId: String,
  domain: String,
  timeSpent: Number, // milliseconds
  date: Date,
});

const TimeEntry = mongoose.model('TimeEntry', TimeEntrySchema);

app.post('/api/track', async (req, res) => {
  try {
    const { userId, timeData, timestamp } = req.body;
    const date = new Date(timestamp);

    const entries = Object.entries(timeData).map(([domain, ms]) => ({
      userId,
      domain,
      timeSpent: ms,
      date,
    }));

    await TimeEntry.insertMany(entries);

    res.status(200).json({ message: 'Tracked data saved' });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save tracked data' });
  }
});

// Productivity classification
const productiveSites = new Set([
  "stackoverflow.com", "github.com", "linkedin.com", "medium.com"
]);
const unproductiveSites = new Set([
  "facebook.com", "twitter.com", "instagram.com", "reddit.com", "youtube.com"
]);

// Utility to classify domain
function classifyDomain(domain) {
  if (productiveSites.has(domain)) return 'productive';
  if (unproductiveSites.has(domain)) return 'unproductive';
  return 'neutral';
}

// Analytics route for a given user
app.get('/api/dashboard/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get last 7 days data
    const now = new Date();
    const weekAgo = new Date(now - 7*24*60*60*1000);

    const entries = await TimeEntry.aggregate([
      { $match: { userId, date: { $gte: weekAgo } } },
      {
        $group: {
          _id: "$domain",
          totalTime: { $sum: "$timeSpent" },
        }
      }
    ]);

    // Aggregate productivity
    let productiveTime = 0;
    let unproductiveTime = 0;
    let neutralTime = 0;

    entries.forEach(entry => {
      const category = classifyDomain(entry._id);
      if (category === 'productive') productiveTime += entry.totalTime;
      else if (category === 'unproductive') unproductiveTime += entry.totalTime;
      else neutralTime += entry.totalTime;
    });

    res.json({
      productiveTime,
      unproductiveTime,
      neutralTime,
      totalTime: productiveTime + unproductiveTime + neutralTime,
      breakdown: entries,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
