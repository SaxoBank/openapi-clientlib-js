const log = saxo.log;

describe("log", () => {
    it("works when it has no subscribers", () => {
        expect(function() {
            log.info("area", "testing info", {});
            log.debug("area", "testing debug", {});
            log.warn("area", "testing warn", {});
            log.error("area", "testing error", {});
        }).not.toThrow();
    });

    it("works when it has subscribers", () => {

        var expectedContextObject = { foo: "bar" };

        var debugSpy = jasmine.createSpy(log.DEBUG);
        log.on(log.DEBUG, debugSpy, expectedContextObject);
        var infoSpy = jasmine.createSpy(log.INFO);
        log.on(log.INFO, infoSpy, expectedContextObject);
        var warnSpy = jasmine.createSpy(log.WARN);
        log.on(log.WARN, warnSpy, expectedContextObject);
        var errorSpy = jasmine.createSpy(log.ERROR);
        log.on(log.ERROR, errorSpy, expectedContextObject);

        log.debug("area1", "testing debug", {info:"info1"});
        log.info("area2", "testing info", {info:"info2"});
        log.warn("area3", "testing warn", {info:"info3"});
        log.error("area4", "testing error", {info:"info4"});

        expect(debugSpy.calls.count()).toEqual(1);
        expect(infoSpy.calls.count()).toEqual(1);
        expect(warnSpy.calls.count()).toEqual(1);
        expect(errorSpy.calls.count()).toEqual(1);

        expect(debugSpy.calls.first()).toEqual({object: expectedContextObject, args:["area1", "testing debug", {info:"info1"}], returnValue: undefined});
        expect(infoSpy.calls.first()).toEqual({object: expectedContextObject, args:["area2", "testing info", {info:"info2"}], returnValue: undefined});
        expect(warnSpy.calls.first()).toEqual({object: expectedContextObject, args:["area3", "testing warn", {info:"info3"}], returnValue: undefined});
        expect(errorSpy.calls.first()).toEqual({object: expectedContextObject, args:["area4", "testing error", {info:"info4"}], returnValue: undefined});

        log.debug("area2", "testing debug", {info:"info6"});
        expect(debugSpy.calls.count()).toEqual(2);
        expect(infoSpy.calls.count()).toEqual(1);
    });
});
