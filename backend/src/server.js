import 'dotenv/config';
import { validateEnv } from './config/validateEnv.js';

validateEnv(); // Fail fast if env vars are missing before starting anything else

import app from './app.js';

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
