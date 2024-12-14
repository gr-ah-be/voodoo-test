const express = require('express');
const bodyParser = require('body-parser');
const { Op } = require('sequelize');
const axios = require('axios');
const db = require('./models');

const app = express();

app.use(bodyParser.json());
app.use(express.static(`${__dirname}/static`));

app.get('/api/games', (req, res) => db.Game.findAll()
  .then(games => res.send(games))
  .catch((err) => {
    console.log('There was an error querying games', JSON.stringify(err));
    return res.send(err);
  }));

  app.post('/api/games', (req, res) => {
    const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
    return db.Game.create({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
      .then(game => res.send(game))
      .catch((err) => {
        console.log('***There was an error creating a game', JSON.stringify(err));
        return res.status(400).send(err);
      });
  });

app.post('/api/games/search', (req, res) => {
  const { name, platform } = req.body;

  const whereConditions = {};
  if (name) {
    whereConditions.name = { [Op.like]: `%${name}%` }; // Partial match for name
  }
  if (platform) {
    whereConditions.platform = platform;
  }

  return db.Game.findAll({ where: whereConditions })
    .then((games) => res.send(games))
    .catch((err) => {
      console.log('There was an error querying games', JSON.stringify(err));
      return res.send(err);
    });
});

app.delete('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id)
    .then(game => game.destroy({ force: true }))
    .then(() => res.send({ id }))
    .catch((err) => {
      console.log('***Error deleting game', JSON.stringify(err));
      res.status(400).send(err);
    });
});

app.put('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id)
    .then((game) => {
      const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
      return game.update({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
        .then(() => res.send(game))
        .catch((err) => {
          console.log('***Error updating game', JSON.stringify(err));
          res.status(400).send(err);
        });
    });
});

app.post('/api/games/populate', async (req, res) => {
  try {
    const androidUrl =
      'https://interview-marketing-eng-dev.s3.eu-west-1.amazonaws.com/android.top100.json';
    const iosUrl =
      'https://interview-marketing-eng-dev.s3.eu-west-1.amazonaws.com/ios.top100.json';

    const [androidResponse, iosResponse] = await Promise.all([
      axios.get(androidUrl),
      axios.get(iosUrl),
    ]);

    const iosGames = iosResponse.data.flat(1);
    const androidGames = androidResponse.data.flat(1);

    const gamesData = [...iosGames, ...androidGames].map((game) => ({
      name: game.name,
      platform: game.os,
      releaseDate: game.release_date || null,
      publisherId: game.publisher_id || null,
      storeId: game.website_url || null,
      bundleId: game.bundle_id || null,
      appVersion: game.version || null,
      isPublished: !!game.release_date,
    }));

    await db.Game.bulkCreate(gamesData, { ignoreDuplicates: true });
    const games = await db.Game.findAll();
    res.status(200).json(games);
  } catch (error) {
    console.log('***Error populating database', JSON.stringify(error));
    res.status(500).json({ error: 'Failed to populate database' });
  }
});

app.listen(3000, () => {
  console.log('Server is up on port 3000');
});

module.exports = app;
