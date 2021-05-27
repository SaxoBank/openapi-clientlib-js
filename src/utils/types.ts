type Obj = Record<string, any>;

export interface ExtendInterface {
    <S0 extends Obj, S1 extends Obj, S2 extends Obj, S3 extends Obj, S4 extends Obj>(deep: true, target: S0, source1: S1, source2: S2, source3: S3, source4: S4): S0 & S1 & S2 & S3 & S4;
    <S0 extends Obj, S1 extends Obj, S2 extends Obj, S3 extends Obj, S4 extends Obj>(target: S0, source1: S1, source2: S2, source3: S3, source4: S4): S0 & S1 & S2 & S3 & S4;

    <S1 extends Obj, S2 extends Obj, S3 extends Obj, S4 extends Obj>(deep: true, target: null, source1: S1, source2: S2, source3: S3, source4: S4): S1 & S2 & S3 & S4;
    <S1 extends Obj, S2 extends Obj, S3 extends Obj, S4 extends Obj>(target: null, source1: S1, source2: S2, source3: S3, source4: S4): S1 & S2 & S3 & S4;
    <S0 extends Obj, S1 extends Obj, S2 extends Obj, S3 extends Obj>(deep: true, target: S0, source1: S1, source2: S2, source3: S3): S0 & S1 & S2 & S3;
    <S0 extends Obj, S1 extends Obj, S2 extends Obj, S3 extends Obj>(target: S0, source1: S1, source2: S2, source3: S3): S0 & S1 & S2 & S3;

    <S1 extends Obj, S2 extends Obj, S3 extends Obj>(deep: true, target: null, source1: S1, source2: S2, source3: S3): S1 & S2 & S3;
    <S1 extends Obj, S2 extends Obj, S3 extends Obj>(target: null, source1: S1, source2: S2, source3: S3): S1 & S2 & S3;
    <S0 extends Obj, S1 extends Obj, S2 extends Obj>(deep: true, target: S0, source1: S1, source2: S2): S0 & S1 & S2;
    <S0 extends Obj, S1 extends Obj, S2 extends Obj>(target: S0, source1: S1, source2: S2): S0 & S1 & S2;

    <S1 extends Obj, S2 extends Obj>(deep: true, target: null, source1: S1, source2: S2): S1 & S2;
    <S1 extends Obj, S2 extends Obj>(target: null, source1: S1, source2: S2): S1 & S2;
    <S0 extends Obj, S1 extends Obj>(deep: true, target: S0, source1: S1): S0 & S1;
    <S0 extends Obj, S1 extends Obj>(target: S0, source1: S1): S0 & S1;

    <S1 extends Obj>(deep: true, target: null, source1: S1): S1;
    <S1 extends Obj>(target: null, source1: S1): S1;
}
