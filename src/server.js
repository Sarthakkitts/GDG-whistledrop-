require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const reportsRouter = require('./routes/reports');
app.use('/reports', reportsRouter);
const moderatorRouter = require('./routes/moderator');
app.use('/moderator', moderatorRouter);
const debatesRouter = require('./routes/debates');
app.use('/', debatesRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`WhistleDrop running on ${PORT}`));