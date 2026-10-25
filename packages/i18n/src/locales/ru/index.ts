import booking from './booking.json' with { type: 'json' };
import catalog from './catalog.json' with { type: 'json' };
import common from './common.json' with { type: 'json' };
import terms from './terms.json' with { type: 'json' };

/** The shared namespaces of one language, loaded together when the language is needed. */
export default { common, terms, booking, catalog };
