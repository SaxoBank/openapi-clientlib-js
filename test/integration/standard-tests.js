/* globals ES6Promise */
/* the promise polyfill requires running before it polyfills...*/
ES6Promise.polyfill();

/* - useful for testing
const log = saxo.log;

log.on(log.DEBUG, console.debug.bind(console));
log.on(log.INFO, console.info.bind(console));
log.on(log.WARN, console.info.bind(console));
log.on(log.ERROR, console.error.bind(console));
*/

function runTests(options) {

    const transport = options.transport;
    const streaming = options.streaming;

    let clientKey;
    let accountKey;
    let instrument;

    describe('transport', () => {

        it('can get user information', (done) => {
            transport.get('port', 'v1/users/me')
                .then(function(result) {
                    expect(result.status).toEqual(200);
                    expect(result.response).toEqual(jasmine.any(Object));
                    expect(result.response.ClientKey).toEqual(jasmine.anything());
                    clientKey = result.response.ClientKey;
                    done();
                },
                function(result) {
                    fail('call failed');
                    done();
                });
        });

        it('can get accounts and client information in the same call-stack', (done) => {

            let calls = 0;

            transport.get('port', 'v1/accounts/me')
                .then(function(result) {
                    expect(result.status).toEqual(200);
                    expect(result.response).toEqual(jasmine.any(Object));
                    expect(result.response.Data).toEqual(jasmine.any(Array));
                    accountKey = result.response.Data[0].AccountKey;
                    calls++;
                    if (calls === 2) {
                        done();
                    }
                },
                function(result) {
                    fail('call failed');
                    done();
                });
            transport.get('port', 'v1/clients/me')
                .then(function(result) {
                    expect(result.status).toEqual(200);
                    expect(result.response).toEqual(jasmine.any(Object));
                    calls++;
                    if (calls === 2) {
                        done();
                    }
                },
                function(result) {
                    fail('call failed');
                    done();
                });
        });

        it('can do an instrument search', (done) => {
            transport.get('ref', 'v1/instruments?AccountKey={accountKey}&AssetTypes={assetTypes}&Keywords={keywords}', { accountKey, assetTypes: 'FxSpot', keywords: 'EUR USD' })
                .then(function(result) {
                    expect(result.status).toEqual(200);
                    expect(result.response).toEqual(jasmine.any(Object));
                    instrument = result.response.Data[0];
                    done();
                },
                function(result) {
                    fail('call failed');
                    done();
                });
        });

        it('can create a market order', (done) => {

            const order = {
                AccountKey: accountKey,
                Uic: instrument.Identifier,
                AssetType: instrument.AssetType,
                Amount: 25000,
                BuySell: 'Buy',
                OrderDuration: {
                    DurationType: 'GoodTillCancel',
                },
                OrderRelation: 'StandAlone',
                OrderType: 'Market',
            };

            transport.post('trade', 'v1/orders', null, { body: order })
                .then(function(result) {
                    expect(result.status).toEqual(201);
                    done();
                },
                function(result) {
                    fail('call failed');
                    done();
                });
        });
    });

    describe('streaming', () => {
        it('can get positions', (done) => {

            const subscriptionArgs = {
                RefreshRate: 2000,
                Arguments: {
                    ClientKey: clientKey,
                    FieldGroups: ['PositionBase', 'PositionView', 'DisplayAndFormat'],
                },
            };

            const positionsSubscription = streaming.createSubscription('port', 'v1/positions/subscriptions', subscriptionArgs,
                (data, type) => {
                    expect(data.length).toEqual(jasmine.any(Number));
                    streaming.disposeSubscription(positionsSubscription);
                    done();
                });
        });
    });

}

export default runTests;
