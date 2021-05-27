import protobuf from 'protobufjs';
import ParserFacade from './parser-facade';
import ParserJson from './parser-json';
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
            expect(parser).toBeInstanceOf(ParserJson);
            expect(parser.getFormatName()).toEqual('application/json');
        });

        it('should return protobuf parser', () => {
            const parser = ParserFacade.getParser(
                'application/x-protobuf',
                'port',
                'v1/balances',
            );
            expect(parser).toBeInstanceOf(ParserProtobuf);
            expect(parser.getFormatName()).toEqual('application/x-protobuf');
        });

        it('should return default parser', () => {
            // @ts-expect-error
            let parser = ParserFacade.getParser('');
            expect(parser).toBeInstanceOf(ParserJson);
            expect(parser.getFormatName()).toEqual('application/json');

            // @ts-expect-error
            parser = ParserFacade.getParser(null);
            expect(parser).toBeInstanceOf(ParserJson);
            expect(parser.getFormatName()).toEqual('application/json');

            // @ts-expect-error
            parser = ParserFacade.getParser(undefined);
            expect(parser).toBeInstanceOf(ParserJson);
            expect(parser.getFormatName()).toEqual('application/json');
        });
    });
});
