import bot from './bot.json' with { type: 'json' };
import crm from './crm.json' with { type: 'json' };
import payments from './payments.json' with { type: 'json' };
import testPay from './test-pay.json' with { type: 'json' };

/** The server's own namespaces of one language. */
export default { bot, crm, payments, 'test-pay': testPay };
