// Compatibility export. New application code depends on the port, while this
// adapter remains the only place that knows about sessions and HomeExchange HTTP.
export { api, SessionExpiredError } from './adapters/homeexchange/client';
