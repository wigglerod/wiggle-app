export default async function handler(req, res) {
  const { sector } = req.query;

  const urls = {
    plateau: process.env.PLATEAU_CALENDAR_URL,
    laurier: process.env.LAURIER_CALENDAR_URL,
  };

  const url = urls[sector];
  if (!url) return res.status(400).json({ error: 'Invalid sector' });

  const response = await fetch(url);
  const icsText = await response.text();

  res.setHeader('Content-Type', 'text/calendar');
  res.send(icsText);
}
