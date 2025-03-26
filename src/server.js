const app = require('./app');
const config = require('./config/config');

const port = config.server.port;

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
}); 