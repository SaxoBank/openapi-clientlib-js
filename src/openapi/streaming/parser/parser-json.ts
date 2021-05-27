import ParserBase from './parser-base';

/**
 * JSON Serialization
 */
class ParserJson extends ParserBase {
    static FORMAT_NAME = 'application/json';

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    parse<T>(data?: T, _?: any): T | undefined {
        return data;
    }

    stringify(data: any) {
        return JSON.stringify(data);
    }

    getFormatName() {
        return ParserJson.FORMAT_NAME;
    }
}

export default ParserJson;
