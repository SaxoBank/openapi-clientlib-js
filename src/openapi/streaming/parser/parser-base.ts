/* eslint-disable @typescript-eslint/no-unused-vars */
abstract class ParserBase {
    getSchemaNames(): string[] | undefined {
        return undefined;
    }

    getSchemaType(
        _schemaName: string,
        _schemaType: string,
    ): unknown | undefined {
        return undefined;
    }

    getSchemaName(): string | null | undefined {
        return undefined;
    }

    getSchema(_schemaName: string): unknown | undefined {
        return undefined;
    }

    addSchema(_schema: string, _schemaName: string): boolean | undefined {
        return undefined;
    }

    abstract parse(
        _data: string | Uint8Array | null | undefined,
        _schemaName: string,
    ): unknown;

    abstract stringify(_data: unknown, _schemaName?: string): string | null;

    abstract getFormatName(): string;
}

export default ParserBase;
