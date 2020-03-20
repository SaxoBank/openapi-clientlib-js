import protobuf from 'protobufjs/dist/protobuf';
import ParserFacade from './parser-facade';
import ParserProtobuf from './parser-protobuf';

ParserFacade.addEngines({
    'application/x-protobuf': protobuf,
});

ParserFacade.addParsers({
    'application/x-protobuf': ParserProtobuf,
});

describe('Parser Facade', () => {
    describe('getParser', () => {
        it('should return json parser', () => {
            const parser = ParserFacade.getParser(
                'application/json',
                'port',
                'v1/balances',
            );
            expect(parser.constructor.name).toEqual('ParserJson');
            expect(parser.getFormatName()).toEqual('application/json');
        });

        it('should return protobuf parser', () => {
            const parser = ParserFacade.getParser(
                'application/x-protobuf',
                'port',
                'v1/balances',
            );
            expect(parser.constructor.name).toEqual('ParserProtobuf');
            expect(parser.getFormatName()).toEqual('application/x-protobuf');
        });

        it('should return default parser', () => {
            let parser = ParserFacade.getParser('');
            expect(parser.constructor.name).toEqual('ParserJson');
            expect(parser.getFormatName()).toEqual('application/json');

            parser = ParserFacade.getParser(null);
            expect(parser.constructor.name).toEqual('ParserJson');
            expect(parser.getFormatName()).toEqual('application/json');

            parser = ParserFacade.getParser(undefined);
            expect(parser.constructor.name).toEqual('ParserJson');
            expect(parser.getFormatName()).toEqual('application/json');
        });
    });
});
