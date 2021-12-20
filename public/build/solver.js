var solver = (function (exports) {
    'use strict';

    // tslint:disable:ban-types
    function isArrayLike(x) {
        return Array.isArray(x) || ArrayBuffer.isView(x);
    }
    function isComparable(x) {
        return typeof x.CompareTo === "function";
    }
    function isEquatable(x) {
        return typeof x.Equals === "function";
    }
    function isHashable(x) {
        return typeof x.GetHashCode === "function";
    }
    function sameConstructor(x, y) {
        return Object.getPrototypeOf(x).constructor === Object.getPrototypeOf(y).constructor;
    }
    class Enumerator {
        constructor(iter) {
            this.iter = iter;
        }
        ["System.Collections.Generic.IEnumerator`1.get_Current"]() {
            return this.current;
        }
        ["System.Collections.IEnumerator.get_Current"]() {
            return this.current;
        }
        ["System.Collections.IEnumerator.MoveNext"]() {
            const cur = this.iter.next();
            this.current = cur.value;
            return !cur.done;
        }
        ["System.Collections.IEnumerator.Reset"]() {
            throw new Error("JS iterators cannot be reset");
        }
        Dispose() {
            return;
        }
    }
    function getEnumerator(o) {
        return typeof o.GetEnumerator === "function"
            ? o.GetEnumerator()
            : new Enumerator(o[Symbol.iterator]());
    }
    function toIterator(en) {
        return {
            [Symbol.iterator]() { return this; },
            next() {
                const hasNext = en["System.Collections.IEnumerator.MoveNext"]();
                const current = hasNext ? en["System.Collections.IEnumerator.get_Current"]() : undefined;
                return { done: !hasNext, value: current };
            },
        };
    }
    function padWithZeros(i, length) {
        let str = i.toString(10);
        while (str.length < length) {
            str = "0" + str;
        }
        return str;
    }
    function dateOffset(date) {
        const date1 = date;
        return typeof date1.offset === "number"
            ? date1.offset
            : (date.kind === 1 /* UTC */
                ? 0 : date.getTimezoneOffset() * -60000);
    }
    class ObjectRef {
        static id(o) {
            if (!ObjectRef.idMap.has(o)) {
                ObjectRef.idMap.set(o, ++ObjectRef.count);
            }
            return ObjectRef.idMap.get(o);
        }
    }
    ObjectRef.idMap = new WeakMap();
    ObjectRef.count = 0;
    function stringHash(s) {
        let i = 0;
        let h = 5381;
        const len = s.length;
        while (i < len) {
            h = (h * 33) ^ s.charCodeAt(i++);
        }
        return h;
    }
    function numberHash(x) {
        return x * 2654435761 | 0;
    }
    // From https://stackoverflow.com/a/37449594
    function combineHashCodes(hashes) {
        if (hashes.length === 0) {
            return 0;
        }
        return hashes.reduce((h1, h2) => {
            return ((h1 << 5) + h1) ^ h2;
        });
    }
    function dateHash(x) {
        return x.getTime();
    }
    function arrayHash(x) {
        const len = x.length;
        const hashes = new Array(len);
        for (let i = 0; i < len; i++) {
            hashes[i] = structuralHash(x[i]);
        }
        return combineHashCodes(hashes);
    }
    function structuralHash(x) {
        if (x == null) {
            return 0;
        }
        switch (typeof x) {
            case "boolean":
                return x ? 1 : 0;
            case "number":
                return numberHash(x);
            case "string":
                return stringHash(x);
            default: {
                if (isHashable(x)) {
                    return x.GetHashCode();
                }
                else if (isArrayLike(x)) {
                    return arrayHash(x);
                }
                else if (x instanceof Date) {
                    return dateHash(x);
                }
                else if (Object.getPrototypeOf(x).constructor === Object) {
                    // TODO: check call-stack to prevent cyclic objects?
                    const hashes = Object.values(x).map((v) => structuralHash(v));
                    return combineHashCodes(hashes);
                }
                else {
                    // Classes don't implement GetHashCode by default, but must use identity hashing
                    return numberHash(ObjectRef.id(x));
                    // return stringHash(String(x));
                }
            }
        }
    }
    function equalArraysWith(x, y, eq) {
        if (x == null) {
            return y == null;
        }
        if (y == null) {
            return false;
        }
        if (x.length !== y.length) {
            return false;
        }
        for (let i = 0; i < x.length; i++) {
            if (!eq(x[i], y[i])) {
                return false;
            }
        }
        return true;
    }
    function equalArrays(x, y) {
        return equalArraysWith(x, y, equals$1);
    }
    function equalObjects(x, y) {
        const xKeys = Object.keys(x);
        const yKeys = Object.keys(y);
        if (xKeys.length !== yKeys.length) {
            return false;
        }
        xKeys.sort();
        yKeys.sort();
        for (let i = 0; i < xKeys.length; i++) {
            if (xKeys[i] !== yKeys[i] || !equals$1(x[xKeys[i]], y[yKeys[i]])) {
                return false;
            }
        }
        return true;
    }
    function equals$1(x, y) {
        if (x === y) {
            return true;
        }
        else if (x == null) {
            return y == null;
        }
        else if (y == null) {
            return false;
        }
        else if (typeof x !== "object") {
            return false;
        }
        else if (isEquatable(x)) {
            return x.Equals(y);
        }
        else if (isArrayLike(x)) {
            return isArrayLike(y) && equalArrays(x, y);
        }
        else if (x instanceof Date) {
            return (y instanceof Date) && compareDates(x, y) === 0;
        }
        else {
            return Object.getPrototypeOf(x).constructor === Object && equalObjects(x, y);
        }
    }
    function compareDates(x, y) {
        let xtime;
        let ytime;
        // DateTimeOffset and DateTime deals with equality differently.
        if ("offset" in x && "offset" in y) {
            xtime = x.getTime();
            ytime = y.getTime();
        }
        else {
            xtime = x.getTime() + dateOffset(x);
            ytime = y.getTime() + dateOffset(y);
        }
        return xtime === ytime ? 0 : (xtime < ytime ? -1 : 1);
    }
    function compareArraysWith(x, y, comp) {
        if (x == null) {
            return y == null ? 0 : 1;
        }
        if (y == null) {
            return -1;
        }
        if (x.length !== y.length) {
            return x.length < y.length ? -1 : 1;
        }
        for (let i = 0, j = 0; i < x.length; i++) {
            j = comp(x[i], y[i]);
            if (j !== 0) {
                return j;
            }
        }
        return 0;
    }
    function compareArrays(x, y) {
        return compareArraysWith(x, y, compare$2);
    }
    function compareObjects(x, y) {
        const xKeys = Object.keys(x);
        const yKeys = Object.keys(y);
        if (xKeys.length !== yKeys.length) {
            return xKeys.length < yKeys.length ? -1 : 1;
        }
        xKeys.sort();
        yKeys.sort();
        for (let i = 0, j = 0; i < xKeys.length; i++) {
            const key = xKeys[i];
            if (key !== yKeys[i]) {
                return key < yKeys[i] ? -1 : 1;
            }
            else {
                j = compare$2(x[key], y[key]);
                if (j !== 0) {
                    return j;
                }
            }
        }
        return 0;
    }
    function compare$2(x, y) {
        if (x === y) {
            return 0;
        }
        else if (x == null) {
            return y == null ? 0 : -1;
        }
        else if (y == null) {
            return 1;
        }
        else if (typeof x !== "object") {
            return x < y ? -1 : 1;
        }
        else if (isComparable(x)) {
            return x.CompareTo(y);
        }
        else if (isArrayLike(x)) {
            return isArrayLike(y) ? compareArrays(x, y) : -1;
        }
        else if (x instanceof Date) {
            return y instanceof Date ? compareDates(x, y) : -1;
        }
        else {
            return Object.getPrototypeOf(x).constructor === Object ? compareObjects(x, y) : -1;
        }
    }

    function seqToString(self) {
        let count = 0;
        let str = "[";
        for (const x of self) {
            if (count === 0) {
                str += toString$2(x);
            }
            else if (count === 100) {
                str += "; ...";
                break;
            }
            else {
                str += "; " + toString$2(x);
            }
            count++;
        }
        return str + "]";
    }
    function toString$2(x, callStack = 0) {
        if (x != null && typeof x === "object") {
            if (typeof x.toString === "function") {
                return x.toString();
            }
            else if (Symbol.iterator in x) {
                return seqToString(x);
            }
            else { // TODO: Date?
                const cons = Object.getPrototypeOf(x).constructor;
                return cons === Object && callStack < 10
                    // Same format as recordToString
                    ? "{ " + Object.entries(x).map(([k, v]) => k + " = " + toString$2(v, callStack + 1)).join("\n  ") + " }"
                    : cons.name;
            }
        }
        return String(x);
    }
    function unionToString(name, fields) {
        if (fields.length === 0) {
            return name;
        }
        else {
            let fieldStr = "";
            let withParens = true;
            if (fields.length === 1) {
                fieldStr = toString$2(fields[0]);
                withParens = fieldStr.indexOf(" ") >= 0;
            }
            else {
                fieldStr = fields.map((x) => toString$2(x)).join(", ");
            }
            return name + (withParens ? " (" : " ") + fieldStr + (withParens ? ")" : "");
        }
    }
    class Union {
        get name() {
            return this.cases()[this.tag];
        }
        toJSON() {
            return this.fields.length === 0 ? this.name : [this.name].concat(this.fields);
        }
        toString() {
            return unionToString(this.name, this.fields);
        }
        GetHashCode() {
            const hashes = this.fields.map((x) => structuralHash(x));
            hashes.splice(0, 0, numberHash(this.tag));
            return combineHashCodes(hashes);
        }
        Equals(other) {
            if (this === other) {
                return true;
            }
            else if (!sameConstructor(this, other)) {
                return false;
            }
            else if (this.tag === other.tag) {
                return equalArrays(this.fields, other.fields);
            }
            else {
                return false;
            }
        }
        CompareTo(other) {
            if (this === other) {
                return 0;
            }
            else if (!sameConstructor(this, other)) {
                return -1;
            }
            else if (this.tag === other.tag) {
                return compareArrays(this.fields, other.fields);
            }
            else {
                return this.tag < other.tag ? -1 : 1;
            }
        }
    }
    function recordToJSON(self) {
        const o = {};
        const keys = Object.keys(self);
        for (let i = 0; i < keys.length; i++) {
            o[keys[i]] = self[keys[i]];
        }
        return o;
    }
    function recordToString(self) {
        return "{ " + Object.entries(self).map(([k, v]) => k + " = " + toString$2(v)).join("\n  ") + " }";
    }
    function recordGetHashCode(self) {
        const hashes = Object.values(self).map((v) => structuralHash(v));
        return combineHashCodes(hashes);
    }
    function recordEquals(self, other) {
        if (self === other) {
            return true;
        }
        else if (!sameConstructor(self, other)) {
            return false;
        }
        else {
            const thisNames = Object.keys(self);
            for (let i = 0; i < thisNames.length; i++) {
                if (!equals$1(self[thisNames[i]], other[thisNames[i]])) {
                    return false;
                }
            }
            return true;
        }
    }
    function recordCompareTo(self, other) {
        if (self === other) {
            return 0;
        }
        else if (!sameConstructor(self, other)) {
            return -1;
        }
        else {
            const thisNames = Object.keys(self);
            for (let i = 0; i < thisNames.length; i++) {
                const result = compare$2(self[thisNames[i]], other[thisNames[i]]);
                if (result !== 0) {
                    return result;
                }
            }
            return 0;
        }
    }
    class Record {
        toJSON() { return recordToJSON(this); }
        toString() { return recordToString(this); }
        GetHashCode() { return recordGetHashCode(this); }
        Equals(other) { return recordEquals(this, other); }
        CompareTo(other) { return recordCompareTo(this, other); }
    }

    // export type decimal = Decimal;
    var NumberStyles;
    (function (NumberStyles) {
        // None = 0x00000000,
        // AllowLeadingWhite = 0x00000001,
        // AllowTrailingWhite = 0x00000002,
        // AllowLeadingSign = 0x00000004,
        // AllowTrailingSign = 0x00000008,
        // AllowParentheses = 0x00000010,
        // AllowDecimalPoint = 0x00000020,
        // AllowThousands = 0x00000040,
        // AllowExponent = 0x00000080,
        // AllowCurrencySymbol = 0x00000100,
        NumberStyles[NumberStyles["AllowHexSpecifier"] = 512] = "AllowHexSpecifier";
        // Integer = AllowLeadingWhite | AllowTrailingWhite | AllowLeadingSign,
        // HexNumber = AllowLeadingWhite | AllowTrailingWhite | AllowHexSpecifier,
        // Number = AllowLeadingWhite | AllowTrailingWhite | AllowLeadingSign |
        //          AllowTrailingSign | AllowDecimalPoint | AllowThousands,
        // Float = AllowLeadingWhite | AllowTrailingWhite | AllowLeadingSign |
        //         AllowDecimalPoint | AllowExponent,
        // Currency = AllowLeadingWhite | AllowTrailingWhite | AllowLeadingSign | AllowTrailingSign |
        //            AllowParentheses | AllowDecimalPoint | AllowThousands | AllowCurrencySymbol,
        // Any = AllowLeadingWhite | AllowTrailingWhite | AllowLeadingSign | AllowTrailingSign |
        //       AllowParentheses | AllowDecimalPoint | AllowThousands | AllowCurrencySymbol | AllowExponent,
    })(NumberStyles || (NumberStyles = {}));

    const symbol = Symbol("numeric");
    function isNumeric(x) {
        return typeof x === "number" || (x === null || x === void 0 ? void 0 : x[symbol]);
    }
    function compare$1(x, y) {
        if (typeof x === "number") {
            return x < y ? -1 : (x > y ? 1 : 0);
        }
        else {
            return x.CompareTo(y);
        }
    }
    function multiply$1(x, y) {
        if (typeof x === "number") {
            return x * y;
        }
        else {
            return x[symbol]().multiply(y);
        }
    }
    function toFixed(x, dp) {
        if (typeof x === "number") {
            return x.toFixed(dp);
        }
        else {
            return x[symbol]().toFixed(dp);
        }
    }
    function toPrecision(x, sd) {
        if (typeof x === "number") {
            return x.toPrecision(sd);
        }
        else {
            return x[symbol]().toPrecision(sd);
        }
    }
    function toExponential(x, dp) {
        if (typeof x === "number") {
            return x.toExponential(dp);
        }
        else {
            return x[symbol]().toExponential(dp);
        }
    }
    function toHex(x) {
        if (typeof x === "number") {
            return (Number(x) >>> 0).toString(16);
        }
        else {
            return x[symbol]().toHex();
        }
    }

    // Adapted from: https://github.com/dcodeIO/long.js/blob/master/src/long.js
    /**
     * wasm optimizations, to do native i64 multiplication and divide
     */
    var wasm = null;
    try {
        wasm = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([
            0, 97, 115, 109, 1, 0, 0, 0, 1, 13, 2, 96, 0, 1, 127, 96, 4, 127, 127, 127, 127, 1, 127, 3, 7, 6, 0, 1, 1, 1, 1, 1, 6, 6, 1, 127, 1, 65, 0, 11, 7, 50, 6, 3, 109, 117, 108, 0, 1, 5, 100, 105, 118, 95, 115, 0, 2, 5, 100, 105, 118, 95, 117, 0, 3, 5, 114, 101, 109, 95, 115, 0, 4, 5, 114, 101, 109, 95, 117, 0, 5, 8, 103, 101, 116, 95, 104, 105, 103, 104, 0, 0, 10, 191, 1, 6, 4, 0, 35, 0, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 126, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 127, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 128, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 129, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 130, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11
        ])), {}).exports;
    }
    catch (e) {
        // no wasm support :(
    }
    /**
     * Constructs a 64 bit two's-complement integer, given its low and high 32 bit values as *signed* integers.
     *  See the from* functions below for more convenient ways of constructing Longs.
     * @exports Long
     * @class A Long class for representing a 64 bit two's-complement integer value.
     * @param {number} low The low (signed) 32 bits of the long
     * @param {number} high The high (signed) 32 bits of the long
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @constructor
     */
    function Long(low, high, unsigned) {
        /**
         * The low 32 bits as a signed value.
         * @type {number}
         */
        this.low = low | 0;
        /**
         * The high 32 bits as a signed value.
         * @type {number}
         */
        this.high = high | 0;
        /**
         * Whether unsigned or not.
         * @type {boolean}
         */
        this.unsigned = !!unsigned;
    }
    Long.prototype.GetHashCode = function () {
        let h1 = this.unsigned ? 1 : 0;
        h1 = ((h1 << 5) + h1) ^ this.high;
        h1 = ((h1 << 5) + h1) ^ this.low;
        return h1;
    };
    Long.prototype.Equals = function (x) { return equals(this, x); };
    Long.prototype.CompareTo = function (x) { return compare(this, x); };
    Long.prototype.toString = function (radix) { return toString$1(this, radix); };
    Long.prototype.toJSON = function () { return toString$1(this); };
    Long.prototype[symbol] = function () {
        const x = this;
        return {
            multiply: y => multiply(x, y),
            toPrecision: sd => String(x) + (0).toPrecision(sd).substr(1),
            toExponential: dp => String(x) + (0).toExponential(dp).substr(1),
            toFixed: dp => String(x) + (0).toFixed(dp).substr(1),
            toHex: () => toString$1(x.unsigned ? x : fromBytes(toBytes(x), true), 16),
        };
    };
    Object.defineProperty(Long.prototype, "__isLong__", { value: true });
    /**
     * @function
     * @param {*} obj Object
     * @returns {boolean}
     * @inner
     */
    function isLong(obj) {
        return (obj && obj["__isLong__"]) === true;
    }
    /**
     * Tests if the specified object is a Long.
     * @function
     * @param {*} obj Object
     * @returns {boolean}
     */
    // Long.isLong = isLong;
    /**
     * A cache of the Long representations of small integer values.
     * @type {!Object}
     * @inner
     */
    var INT_CACHE = {};
    /**
     * A cache of the Long representations of small unsigned integer values.
     * @type {!Object}
     * @inner
     */
    var UINT_CACHE = {};
    /**
     * @param {number} value
     * @param {boolean=} unsigned
     * @returns {!Long}
     * @inner
     */
    function fromInt(value, unsigned) {
        var obj, cachedObj, cache;
        if (unsigned) {
            value >>>= 0;
            if (cache = (0 <= value && value < 256)) {
                cachedObj = UINT_CACHE[value];
                if (cachedObj)
                    return cachedObj;
            }
            obj = fromBits(value, (value | 0) < 0 ? -1 : 0, true);
            if (cache)
                UINT_CACHE[value] = obj;
            return obj;
        }
        else {
            value |= 0;
            if (cache = (-128 <= value && value < 128)) {
                cachedObj = INT_CACHE[value];
                if (cachedObj)
                    return cachedObj;
            }
            obj = fromBits(value, value < 0 ? -1 : 0, false);
            if (cache)
                INT_CACHE[value] = obj;
            return obj;
        }
    }
    /**
     * Returns a Long representing the given 32 bit integer value.
     * @function
     * @param {number} value The 32 bit integer in question
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @returns {!Long} The corresponding Long value
     */
    // Long.fromInt = fromInt;
    /**
     * @param {number} value
     * @param {boolean=} unsigned
     * @returns {!Long}
     * @inner
     */
    function fromNumber(value, unsigned) {
        if (isNaN(value))
            return unsigned ? UZERO : ZERO;
        if (unsigned) {
            if (value < 0)
                return UZERO;
            if (value >= TWO_PWR_64_DBL)
                return MAX_UNSIGNED_VALUE;
        }
        else {
            if (value <= -TWO_PWR_63_DBL)
                return MIN_VALUE;
            if (value + 1 >= TWO_PWR_63_DBL)
                return MAX_VALUE;
        }
        if (value < 0)
            return negate$1(fromNumber(-value, unsigned));
        return fromBits((value % TWO_PWR_32_DBL) | 0, (value / TWO_PWR_32_DBL) | 0, unsigned);
    }
    /**
     * Returns a Long representing the given value, provided that it is a finite number. Otherwise, zero is returned.
     * @function
     * @param {number} value The number in question
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @returns {!Long} The corresponding Long value
     */
    // Long.fromNumber = fromNumber;
    /**
     * @param {number} lowBits
     * @param {number} highBits
     * @param {boolean=} unsigned
     * @returns {!Long}
     * @inner
     */
    function fromBits(lowBits, highBits, unsigned) {
        return new Long(lowBits, highBits, unsigned);
    }
    /**
     * Returns a Long representing the 64 bit integer that comes by concatenating the given low and high bits. Each is
     *  assumed to use 32 bits.
     * @function
     * @param {number} lowBits The low 32 bits
     * @param {number} highBits The high 32 bits
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @returns {!Long} The corresponding Long value
     */
    // Long.fromBits = fromBits;
    /**
     * @function
     * @param {number} base
     * @param {number} exponent
     * @returns {number}
     * @inner
     */
    var pow_dbl = Math.pow; // Used 4 times (4*8 to 15+4)
    /**
     * @param {string} str
     * @param {(boolean|number)=} unsigned
     * @param {number=} radix
     * @returns {!Long}
     * @inner
     */
    function fromString(str, unsigned, radix) {
        if (str.length === 0)
            throw Error('empty string');
        if (str === "NaN" || str === "Infinity" || str === "+Infinity" || str === "-Infinity")
            return ZERO;
        if (typeof unsigned === 'number') {
            // For goog.math.long compatibility
            radix = unsigned,
                unsigned = false;
        }
        else {
            unsigned = !!unsigned;
        }
        radix = radix || 10;
        if (radix < 2 || 36 < radix)
            throw RangeError('radix');
        var p = str.indexOf('-');
        if (p > 0)
            throw Error('interior hyphen');
        else if (p === 0) {
            return negate$1(fromString(str.substring(1), unsigned, radix));
        }
        // Do several (8) digits each time through the loop, so as to
        // minimize the calls to the very expensive emulated div.
        var radixToPower = fromNumber(pow_dbl(radix, 8));
        var result = ZERO;
        for (var i = 0; i < str.length; i += 8) {
            var size = Math.min(8, str.length - i), value = parseInt(str.substring(i, i + size), radix);
            if (size < 8) {
                var power = fromNumber(pow_dbl(radix, size));
                result = add(multiply(result, power), fromNumber(value));
            }
            else {
                result = multiply(result, radixToPower);
                result = add(result, fromNumber(value));
            }
        }
        result.unsigned = unsigned;
        return result;
    }
    /**
     * Returns a Long representation of the given string, written using the specified radix.
     * @function
     * @param {string} str The textual representation of the Long
     * @param {(boolean|number)=} unsigned Whether unsigned or not, defaults to signed
     * @param {number=} radix The radix in which the text is written (2-36), defaults to 10
     * @returns {!Long} The corresponding Long value
     */
    // Long.fromString = fromString;
    /**
     * @function
     * @param {!Long|number|string|!{low: number, high: number, unsigned: boolean}} val
     * @param {boolean=} unsigned
     * @returns {!Long}
     * @inner
     */
    function fromValue(val, unsigned) {
        if (typeof val === 'number')
            return fromNumber(val, unsigned);
        if (typeof val === 'string')
            return fromString(val, unsigned);
        // Throws for non-objects, converts non-instanceof Long:
        return fromBits(val.low, val.high, typeof unsigned === 'boolean' ? unsigned : val.unsigned);
    }
    /**
     * Converts the specified value to a Long using the appropriate from* function for its type.
     * @function
     * @param {!Long|number|string|!{low: number, high: number, unsigned: boolean}} val Value
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @returns {!Long}
     */
    // Long.fromValue = fromValue;
    // NOTE: the compiler should inline these constant values below and then remove these variables, so there should be
    // no runtime penalty for these.
    /**
     * @type {number}
     * @const
     * @inner
     */
    var TWO_PWR_16_DBL = 1 << 16;
    /**
     * @type {number}
     * @const
     * @inner
     */
    var TWO_PWR_24_DBL = 1 << 24;
    /**
     * @type {number}
     * @const
     * @inner
     */
    var TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;
    /**
     * @type {number}
     * @const
     * @inner
     */
    var TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL;
    /**
     * @type {number}
     * @const
     * @inner
     */
    var TWO_PWR_63_DBL = TWO_PWR_64_DBL / 2;
    /**
     * @type {!Long}
     * @const
     * @inner
     */
    var TWO_PWR_24 = fromInt(TWO_PWR_24_DBL);
    /**
     * @type {!Long}
     * @inner
     */
    var ZERO = fromInt(0);
    /**
     * Signed zero.
     * @type {!Long}
     */
    // Long.ZERO = ZERO;
    /**
     * @type {!Long}
     * @inner
     */
    var UZERO = fromInt(0, true);
    /**
     * Unsigned zero.
     * @type {!Long}
     */
    // Long.UZERO = UZERO;
    /**
     * @type {!Long}
     * @inner
     */
    var ONE = fromInt(1);
    /**
     * Signed one.
     * @type {!Long}
     */
    // Long.ONE = ONE;
    /**
     * @type {!Long}
     * @inner
     */
    var UONE = fromInt(1, true);
    /**
     * Unsigned one.
     * @type {!Long}
     */
    // Long.UONE = UONE;
    /**
     * @type {!Long}
     * @inner
     */
    var NEG_ONE = fromInt(-1);
    /**
     * Signed negative one.
     * @type {!Long}
     */
    // Long.NEG_ONE = NEG_ONE;
    /**
     * @type {!Long}
     * @inner
     */
    var MAX_VALUE = fromBits(0xFFFFFFFF | 0, 0x7FFFFFFF | 0, false);
    /**
     * Maximum signed value.
     * @type {!Long}
     */
    // Long.MAX_VALUE = MAX_VALUE;
    /**
     * @type {!Long}
     * @inner
     */
    var MAX_UNSIGNED_VALUE = fromBits(0xFFFFFFFF | 0, 0xFFFFFFFF | 0, true);
    /**
     * Maximum unsigned value.
     * @type {!Long}
     */
    // Long.MAX_UNSIGNED_VALUE = MAX_UNSIGNED_VALUE;
    /**
     * @type {!Long}
     * @inner
     */
    var MIN_VALUE = fromBits(0, 0x80000000 | 0, false);
    /**
     * Minimum signed value.
     * @type {!Long}
     */
    // Long.MIN_VALUE = MIN_VALUE;
    /**
     * @alias Long.prototype
     * @inner
     */
    // var LongPrototype = Long.prototype;
    /**
     * Converts the Long to a 32 bit integer, assuming it is a 32 bit integer.
     * @this {!Long}
     * @returns {number}
     */
    function toInt($this) {
        return $this.unsigned ? $this.low >>> 0 : $this.low;
    }
    /**
     * Converts the Long to a the nearest floating-point representation of this value (double, 53 bit mantissa).
     * @this {!Long}
     * @returns {number}
     */
    function toNumber($this) {
        if ($this.unsigned)
            return (($this.high >>> 0) * TWO_PWR_32_DBL) + ($this.low >>> 0);
        return $this.high * TWO_PWR_32_DBL + ($this.low >>> 0);
    }
    /**
     * Converts the Long to a string written in the specified radix.
     * @this {!Long}
     * @param {number=} radix Radix (2-36), defaults to 10
     * @returns {string}
     * @override
     * @throws {RangeError} If `radix` is out of range
     */
    function toString$1($this, radix) {
        radix = radix || 10;
        if (radix < 2 || 36 < radix)
            throw RangeError('radix');
        if (isZero($this))
            return '0';
        if (isNegative($this)) { // Unsigned Longs are never negative
            if (equals($this, MIN_VALUE)) {
                // We need to change the Long value before it can be negated, so we remove
                // the bottom-most digit in this base and then recurse to do the rest.
                var radixLong = fromNumber(radix), div = divide($this, radixLong), rem1 = subtract(multiply(div, radixLong), $this);
                return toString$1(div, radix) + toInt(rem1).toString(radix);
            }
            else
                return '-' + toString$1(negate$1($this), radix);
        }
        // Do several (6) digits each time through the loop, so as to
        // minimize the calls to the very expensive emulated div.
        var radixToPower = fromNumber(pow_dbl(radix, 6), $this.unsigned), rem = $this;
        var result = '';
        while (true) {
            var remDiv = divide(rem, radixToPower), intval = toInt(subtract(rem, multiply(remDiv, radixToPower))) >>> 0, digits = intval.toString(radix);
            rem = remDiv;
            if (isZero(rem))
                return digits + result;
            else {
                while (digits.length < 6)
                    digits = '0' + digits;
                result = '' + digits + result;
            }
        }
    }
    /**
     * Tests if this Long's value equals zero.
     * @this {!Long}
     * @returns {boolean}
     */
    function isZero($this) {
        return $this.high === 0 && $this.low === 0;
    }
    /**
     * Tests if this Long's value equals zero. This is an alias of {@link Long#isZero}.
     * @returns {boolean}
     */
    // LongPrototype.eqz = LongPrototype.isZero;
    /**
     * Tests if this Long's value is negative.
     * @this {!Long}
     * @returns {boolean}
     */
    function isNegative($this) {
        return !$this.unsigned && $this.high < 0;
    }
    /**
     * Tests if this Long's value is odd.
     * @this {!Long}
     * @returns {boolean}
     */
    function isOdd($this) {
        return ($this.low & 1) === 1;
    }
    /**
     * Tests if this Long's value equals the specified's.
     * @this {!Long}
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    function equals($this, other) {
        if (!isLong(other))
            other = fromValue(other);
        if ($this.unsigned !== other.unsigned && ($this.high >>> 31) === 1 && (other.high >>> 31) === 1)
            return false;
        return $this.high === other.high && $this.low === other.low;
    }
    /**
     * Tests if this Long's value differs from the specified's. This is an alias of {@link Long#notEquals}.
     * @function
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    // LongPrototype.neq = LongPrototype.notEquals;
    /**
     * Tests if this Long's value differs from the specified's. This is an alias of {@link Long#notEquals}.
     * @function
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    // LongPrototype.ne = LongPrototype.notEquals;
    /**
     * Tests if this Long's value is less than the specified's.
     * @this {!Long}
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    function lessThan($this, other) {
        return compare($this, /* validates */ other) < 0;
    }
    /**
     * Tests if this Long's value is less than or equal the specified's. This is an alias of {@link Long#lessThanOrEqual}.
     * @function
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    // LongPrototype.lte = LongPrototype.lessThanOrEqual;
    /**
     * Tests if this Long's value is less than or equal the specified's. This is an alias of {@link Long#lessThanOrEqual}.
     * @function
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    // LongPrototype.le = LongPrototype.lessThanOrEqual;
    /**
     * Tests if this Long's value is greater than the specified's.
     * @this {!Long}
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    function greaterThan($this, other) {
        return compare($this, /* validates */ other) > 0;
    }
    /**
     * Tests if this Long's value is greater than the specified's. This is an alias of {@link Long#greaterThan}.
     * @function
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    // LongPrototype.gt = LongPrototype.greaterThan;
    /**
     * Tests if this Long's value is greater than or equal the specified's.
     * @this {!Long}
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    function greaterThanOrEqual($this, other) {
        return compare($this, /* validates */ other) >= 0;
    }
    /**
     * Tests if this Long's value is greater than or equal the specified's. This is an alias of {@link Long#greaterThanOrEqual}.
     * @function
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    // LongPrototype.gte = LongPrototype.greaterThanOrEqual;
    /**
     * Tests if this Long's value is greater than or equal the specified's. This is an alias of {@link Long#greaterThanOrEqual}.
     * @function
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    // LongPrototype.ge = LongPrototype.greaterThanOrEqual;
    /**
     * Compares this Long's value with the specified's.
     * @this {!Long}
     * @param {!Long|number|string} other Other value
     * @returns {number} 0 if they are the same, 1 if the this is greater and -1
     *  if the given one is greater
     */
    function compare($this, other) {
        if (!isLong(other))
            other = fromValue(other);
        if (equals($this, other))
            return 0;
        var thisNeg = isNegative($this), otherNeg = isNegative(other);
        if (thisNeg && !otherNeg)
            return -1;
        if (!thisNeg && otherNeg)
            return 1;
        // At this point the sign bits are the same
        if (!$this.unsigned)
            return isNegative(subtract($this, other)) ? -1 : 1;
        // Both are positive if at least one is unsigned
        return (other.high >>> 0) > ($this.high >>> 0) || (other.high === $this.high && (other.low >>> 0) > ($this.low >>> 0)) ? -1 : 1;
    }
    /**
     * Compares this Long's value with the specified's. This is an alias of {@link Long#compare}.
     * @function
     * @param {!Long|number|string} other Other value
     * @returns {number} 0 if they are the same, 1 if the this is greater and -1
     *  if the given one is greater
     */
    // LongPrototype.comp = LongPrototype.compare;
    /**
     * Negates this Long's value.
     * @this {!Long}
     * @returns {!Long} Negated Long
     */
    function negate$1($this) {
        if (!$this.unsigned && equals($this, MIN_VALUE))
            return MIN_VALUE;
        return add(not($this), ONE);
    }
    /**
     * Negates this Long's value. This is an alias of {@link Long#negate}.
     * @function
     * @returns {!Long} Negated Long
     */
    // LongPrototype.neg = LongPrototype.negate;
    /**
     * Returns the sum of this and the specified Long.
     * @this {!Long}
     * @param {!Long|number|string} addend Addend
     * @returns {!Long} Sum
     */
    function add($this, addend) {
        if (!isLong(addend))
            addend = fromValue(addend);
        // Divide each number into 4 chunks of 16 bits, and then sum the chunks.
        var a48 = $this.high >>> 16;
        var a32 = $this.high & 0xFFFF;
        var a16 = $this.low >>> 16;
        var a00 = $this.low & 0xFFFF;
        var b48 = addend.high >>> 16;
        var b32 = addend.high & 0xFFFF;
        var b16 = addend.low >>> 16;
        var b00 = addend.low & 0xFFFF;
        var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
        c00 += a00 + b00;
        c16 += c00 >>> 16;
        c00 &= 0xFFFF;
        c16 += a16 + b16;
        c32 += c16 >>> 16;
        c16 &= 0xFFFF;
        c32 += a32 + b32;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c48 += a48 + b48;
        c48 &= 0xFFFF;
        return fromBits((c16 << 16) | c00, (c48 << 16) | c32, $this.unsigned);
    }
    /**
     * Returns the difference of this and the specified Long.
     * @this {!Long}
     * @param {!Long|number|string} subtrahend Subtrahend
     * @returns {!Long} Difference
     */
    function subtract($this, subtrahend) {
        if (!isLong(subtrahend))
            subtrahend = fromValue(subtrahend);
        return add($this, negate$1(subtrahend));
    }
    /**
     * Returns the difference of this and the specified Long. This is an alias of {@link Long#subtract}.
     * @function
     * @param {!Long|number|string} subtrahend Subtrahend
     * @returns {!Long} Difference
     */
    // LongPrototype.sub = LongPrototype.subtract;
    /**
     * Returns the product of this and the specified Long.
     * @this {!Long}
     * @param {!Long|number|string} multiplier Multiplier
     * @returns {!Long} Product
     */
    function multiply($this, multiplier) {
        if (isZero($this))
            return $this.unsigned ? UZERO : ZERO;
        if (!isLong(multiplier))
            multiplier = fromValue(multiplier);
        // use wasm support if present
        if (wasm) {
            var low = wasm.mul($this.low, $this.high, multiplier.low, multiplier.high);
            return fromBits(low, wasm.get_high(), $this.unsigned);
        }
        if (isZero(multiplier))
            return $this.unsigned ? UZERO : ZERO;
        if (equals($this, MIN_VALUE))
            return isOdd(multiplier) ? MIN_VALUE : ZERO;
        if (equals(multiplier, MIN_VALUE))
            return isOdd($this) ? MIN_VALUE : ZERO;
        if (isNegative($this)) {
            if (isNegative(multiplier))
                return multiply(negate$1($this), negate$1(multiplier));
            else
                return negate$1(multiply(negate$1($this), multiplier));
        }
        else if (isNegative(multiplier))
            return negate$1(multiply($this, negate$1(multiplier)));
        // If both longs are small, use float multiplication
        if (lessThan($this, TWO_PWR_24) && lessThan(multiplier, TWO_PWR_24))
            return fromNumber(toNumber($this) * toNumber(multiplier), $this.unsigned);
        // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
        // We can skip products that would overflow.
        var a48 = $this.high >>> 16;
        var a32 = $this.high & 0xFFFF;
        var a16 = $this.low >>> 16;
        var a00 = $this.low & 0xFFFF;
        var b48 = multiplier.high >>> 16;
        var b32 = multiplier.high & 0xFFFF;
        var b16 = multiplier.low >>> 16;
        var b00 = multiplier.low & 0xFFFF;
        var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
        c00 += a00 * b00;
        c16 += c00 >>> 16;
        c00 &= 0xFFFF;
        c16 += a16 * b00;
        c32 += c16 >>> 16;
        c16 &= 0xFFFF;
        c16 += a00 * b16;
        c32 += c16 >>> 16;
        c16 &= 0xFFFF;
        c32 += a32 * b00;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c32 += a16 * b16;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c32 += a00 * b32;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
        c48 &= 0xFFFF;
        return fromBits((c16 << 16) | c00, (c48 << 16) | c32, $this.unsigned);
    }
    /**
     * Returns the product of this and the specified Long. This is an alias of {@link Long#multiply}.
     * @function
     * @param {!Long|number|string} multiplier Multiplier
     * @returns {!Long} Product
     */
    // LongPrototype.mul = LongPrototype.multiply;
    /**
     * Returns this Long divided by the specified. The result is signed if this Long is signed or
     *  unsigned if this Long is unsigned.
     * @this {!Long}
     * @param {!Long|number|string} divisor Divisor
     * @returns {!Long} Quotient
     */
    function divide($this, divisor) {
        if (!isLong(divisor))
            divisor = fromValue(divisor);
        if (isZero(divisor))
            throw Error('division by zero');
        // use wasm support if present
        if (wasm) {
            // guard against signed division overflow: the largest
            // negative number / -1 would be 1 larger than the largest
            // positive number, due to two's complement.
            if (!$this.unsigned &&
                $this.high === -0x80000000 &&
                divisor.low === -1 && divisor.high === -1) {
                // be consistent with non-wasm code path
                return $this;
            }
            var low = ($this.unsigned ? wasm.div_u : wasm.div_s)($this.low, $this.high, divisor.low, divisor.high);
            return fromBits(low, wasm.get_high(), $this.unsigned);
        }
        if (isZero($this))
            return $this.unsigned ? UZERO : ZERO;
        var approx, rem, res;
        if (!$this.unsigned) {
            // This section is only relevant for signed longs and is derived from the
            // closure library as a whole.
            if (equals($this, MIN_VALUE)) {
                if (equals(divisor, ONE) || equals(divisor, NEG_ONE))
                    return MIN_VALUE; // recall that -MIN_VALUE == MIN_VALUE
                else if (equals(divisor, MIN_VALUE))
                    return ONE;
                else {
                    // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
                    var halfThis = shiftRight($this, 1);
                    approx = shiftLeft(divide(halfThis, divisor), 1);
                    if (equals(approx, ZERO)) {
                        return isNegative(divisor) ? ONE : NEG_ONE;
                    }
                    else {
                        rem = subtract($this, multiply(divisor, approx));
                        res = add(approx, divide(rem, divisor));
                        return res;
                    }
                }
            }
            else if (equals(divisor, MIN_VALUE))
                return $this.unsigned ? UZERO : ZERO;
            if (isNegative($this)) {
                if (isNegative(divisor))
                    return divide(negate$1($this), negate$1(divisor));
                return negate$1(divide(negate$1($this), divisor));
            }
            else if (isNegative(divisor))
                return negate$1(divide($this, negate$1(divisor)));
            res = ZERO;
        }
        else {
            // The algorithm below has not been made for unsigned longs. It's therefore
            // required to take special care of the MSB prior to running it.
            if (!divisor.unsigned)
                divisor = toUnsigned(divisor);
            if (greaterThan(divisor, $this))
                return UZERO;
            if (greaterThan(divisor, shiftRightUnsigned($this, 1))) // 15 >>> 1 = 7 ; with divisor = 8 ; true
                return UONE;
            res = UZERO;
        }
        // Repeat the following until the remainder is less than other:  find a
        // floating-point that approximates remainder / other *from below*, add this
        // into the result, and subtract it from the remainder.  It is critical that
        // the approximate value is less than or equal to the real value so that the
        // remainder never becomes negative.
        rem = $this;
        while (greaterThanOrEqual(rem, divisor)) {
            // Approximate the result of division. This may be a little greater or
            // smaller than the actual value.
            approx = Math.max(1, Math.floor(toNumber(rem) / toNumber(divisor)));
            // We will tweak the approximate result by changing it in the 48-th digit or
            // the smallest non-fractional digit, whichever is larger.
            var log2 = Math.ceil(Math.log(approx) / Math.LN2), delta = (log2 <= 48) ? 1 : pow_dbl(2, log2 - 48), 
            // Decrease the approximation until it is smaller than the remainder.  Note
            // that if it is too large, the product overflows and is negative.
            approxRes = fromNumber(approx), approxRem = multiply(approxRes, divisor);
            while (isNegative(approxRem) || greaterThan(approxRem, rem)) {
                approx -= delta;
                approxRes = fromNumber(approx, $this.unsigned);
                approxRem = multiply(approxRes, divisor);
            }
            // We know the answer can't be zero... and actually, zero would cause
            // infinite recursion since we would make no progress.
            if (isZero(approxRes))
                approxRes = ONE;
            res = add(res, approxRes);
            rem = subtract(rem, approxRem);
        }
        return res;
    }
    /**
     * Returns this Long modulo the specified. This is an alias of {@link Long#modulo}.
     * @function
     * @param {!Long|number|string} divisor Divisor
     * @returns {!Long} Remainder
     */
    // LongPrototype.mod = LongPrototype.modulo;
    /**
     * Returns this Long modulo the specified. This is an alias of {@link Long#modulo}.
     * @function
     * @param {!Long|number|string} divisor Divisor
     * @returns {!Long} Remainder
     */
    // LongPrototype.rem = LongPrototype.modulo;
    /**
     * Returns the bitwise NOT of this Long.
     * @this {!Long}
     * @returns {!Long}
     */
    function not($this) {
        return fromBits(~$this.low, ~$this.high, $this.unsigned);
    }
    /**
     * Returns this Long with bits shifted to the left by the given amount.
     * @this {!Long}
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    function shiftLeft($this, numBits) {
        if (isLong(numBits))
            numBits = toInt(numBits);
        if ((numBits &= 63) === 0)
            return $this;
        else if (numBits < 32)
            return fromBits($this.low << numBits, ($this.high << numBits) | ($this.low >>> (32 - numBits)), $this.unsigned);
        else
            return fromBits(0, $this.low << (numBits - 32), $this.unsigned);
    }
    /**
     * Returns this Long with bits shifted to the left by the given amount. This is an alias of {@link Long#shiftLeft}.
     * @function
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    // LongPrototype.shl = LongPrototype.shiftLeft;
    /**
     * Returns this Long with bits arithmetically shifted to the right by the given amount.
     * @this {!Long}
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    function shiftRight($this, numBits) {
        if (isLong(numBits))
            numBits = toInt(numBits);
        if ((numBits &= 63) === 0)
            return $this;
        else if (numBits < 32)
            return fromBits(($this.low >>> numBits) | ($this.high << (32 - numBits)), $this.high >> numBits, $this.unsigned);
        else
            return fromBits($this.high >> (numBits - 32), $this.high >= 0 ? 0 : -1, $this.unsigned);
    }
    /**
     * Returns this Long with bits arithmetically shifted to the right by the given amount. This is an alias of {@link Long#shiftRight}.
     * @function
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    // LongPrototype.shr = LongPrototype.shiftRight;
    /**
     * Returns this Long with bits logically shifted to the right by the given amount.
     * @this {!Long}
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    function shiftRightUnsigned($this, numBits) {
        if (isLong(numBits))
            numBits = toInt(numBits);
        numBits &= 63;
        if (numBits === 0)
            return $this;
        else {
            var high = $this.high;
            if (numBits < 32) {
                var low = $this.low;
                return fromBits((low >>> numBits) | (high << (32 - numBits)), high >>> numBits, $this.unsigned);
            }
            else if (numBits === 32)
                return fromBits(high, 0, $this.unsigned);
            else
                return fromBits(high >>> (numBits - 32), 0, $this.unsigned);
        }
    }
    /**
     * Converts this Long to unsigned.
     * @this {!Long}
     * @returns {!Long} Unsigned long
     */
    function toUnsigned($this) {
        if ($this.unsigned)
            return $this;
        return fromBits($this.low, $this.high, true);
    }
    /**
     * Converts this Long to its byte representation.
     * @param {boolean=} le Whether little or big endian, defaults to big endian
     * @this {!Long}
     * @returns {!Array.<number>} Byte representation
     */
    function toBytes($this, le) {
        return le ? toBytesLE($this) : toBytesBE($this);
    }
    /**
     * Converts this Long to its little endian byte representation.
     * @this {!Long}
     * @returns {!Array.<number>} Little endian byte representation
     */
    function toBytesLE($this) {
        var hi = $this.high, lo = $this.low;
        return [
            lo & 0xff,
            lo >>> 8 & 0xff,
            lo >>> 16 & 0xff,
            lo >>> 24,
            hi & 0xff,
            hi >>> 8 & 0xff,
            hi >>> 16 & 0xff,
            hi >>> 24
        ];
    }
    /**
     * Converts this Long to its big endian byte representation.
     * @this {!Long}
     * @returns {!Array.<number>} Big endian byte representation
     */
    function toBytesBE($this) {
        var hi = $this.high, lo = $this.low;
        return [
            hi >>> 24,
            hi >>> 16 & 0xff,
            hi >>> 8 & 0xff,
            hi & 0xff,
            lo >>> 24,
            lo >>> 16 & 0xff,
            lo >>> 8 & 0xff,
            lo & 0xff
        ];
    }
    /**
     * Creates a Long from its byte representation.
     * @param {!Array.<number>} bytes Byte representation
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @param {boolean=} le Whether little or big endian, defaults to big endian
     * @returns {Long} The corresponding Long value
     */
    function fromBytes(bytes, unsigned, le) {
        return le ? fromBytesLE(bytes, unsigned) : fromBytesBE(bytes, unsigned);
    }
    /**
     * Creates a Long from its little endian byte representation.
     * @param {!Array.<number>} bytes Little endian byte representation
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @returns {Long} The corresponding Long value
     */
    function fromBytesLE(bytes, unsigned) {
        return new Long(bytes[0] |
            bytes[1] << 8 |
            bytes[2] << 16 |
            bytes[3] << 24, bytes[4] |
            bytes[5] << 8 |
            bytes[6] << 16 |
            bytes[7] << 24, unsigned);
    }
    /**
     * Creates a Long from its big endian byte representation.
     * @param {!Array.<number>} bytes Big endian byte representation
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @returns {Long} The corresponding Long value
     */
    function fromBytesBE(bytes, unsigned) {
        return new Long(bytes[4] << 24 |
            bytes[5] << 16 |
            bytes[6] << 8 |
            bytes[7], bytes[0] << 24 |
            bytes[1] << 16 |
            bytes[2] << 8 |
            bytes[3], unsigned);
    }

    /**
     * DateTimeOffset functions.
     *
     * Note: Date instances are always DateObjects in local
     * timezone (because JS dates are all kinds of messed up).
     * A local date returns UTC epoc when `.getTime()` is called.
     *
     * Basically; invariant: date.getTime() always return UTC time.
     */
    function dateOffsetToString(offset) {
        const isMinus = offset < 0;
        offset = Math.abs(offset);
        const hours = ~~(offset / 3600000);
        const minutes = (offset % 3600000) / 60000;
        return (isMinus ? "-" : "+") +
            padWithZeros(hours, 2) + ":" +
            padWithZeros(minutes, 2);
    }
    function dateToHalfUTCString(date, half) {
        const str = date.toISOString();
        return half === "first"
            ? str.substring(0, str.indexOf("T"))
            : str.substring(str.indexOf("T") + 1, str.length - 1);
    }
    function dateToISOString(d, utc) {
        if (utc) {
            return d.toISOString();
        }
        else {
            // JS Date is always local
            const printOffset = d.kind == null ? true : d.kind === 2 /* Local */;
            return padWithZeros(d.getFullYear(), 4) + "-" +
                padWithZeros(d.getMonth() + 1, 2) + "-" +
                padWithZeros(d.getDate(), 2) + "T" +
                padWithZeros(d.getHours(), 2) + ":" +
                padWithZeros(d.getMinutes(), 2) + ":" +
                padWithZeros(d.getSeconds(), 2) + "." +
                padWithZeros(d.getMilliseconds(), 3) +
                (printOffset ? dateOffsetToString(d.getTimezoneOffset() * -60000) : "");
        }
    }
    function dateToISOStringWithOffset(dateWithOffset, offset) {
        const str = dateWithOffset.toISOString();
        return str.substring(0, str.length - 1) + dateOffsetToString(offset);
    }
    function dateToStringWithCustomFormat(date, format, utc) {
        return format.replace(/(\w)\1*/g, (match) => {
            let rep = Number.NaN;
            switch (match.substring(0, 1)) {
                case "y":
                    const y = utc ? date.getUTCFullYear() : date.getFullYear();
                    rep = match.length < 4 ? y % 100 : y;
                    break;
                case "M":
                    rep = (utc ? date.getUTCMonth() : date.getMonth()) + 1;
                    break;
                case "d":
                    rep = utc ? date.getUTCDate() : date.getDate();
                    break;
                case "H":
                    rep = utc ? date.getUTCHours() : date.getHours();
                    break;
                case "h":
                    const h = utc ? date.getUTCHours() : date.getHours();
                    rep = h > 12 ? h % 12 : h;
                    break;
                case "m":
                    rep = utc ? date.getUTCMinutes() : date.getMinutes();
                    break;
                case "s":
                    rep = utc ? date.getUTCSeconds() : date.getSeconds();
                    break;
                case "f":
                    rep = utc ? date.getUTCMilliseconds() : date.getMilliseconds();
                    break;
            }
            if (Number.isNaN(rep)) {
                return match;
            }
            else {
                return (rep < 10 && match.length > 1) ? "0" + rep : "" + rep;
            }
        });
    }
    function dateToStringWithOffset(date, format) {
        var _a, _b, _c;
        const d = new Date(date.getTime() + ((_a = date.offset) !== null && _a !== void 0 ? _a : 0));
        if (typeof format !== "string") {
            return d.toISOString().replace(/\.\d+/, "").replace(/[A-Z]|\.\d+/g, " ") + dateOffsetToString(((_b = date.offset) !== null && _b !== void 0 ? _b : 0));
        }
        else if (format.length === 1) {
            switch (format) {
                case "D":
                case "d": return dateToHalfUTCString(d, "first");
                case "T":
                case "t": return dateToHalfUTCString(d, "second");
                case "O":
                case "o": return dateToISOStringWithOffset(d, ((_c = date.offset) !== null && _c !== void 0 ? _c : 0));
                default: throw new Error("Unrecognized Date print format");
            }
        }
        else {
            return dateToStringWithCustomFormat(d, format, true);
        }
    }
    function dateToStringWithKind(date, format) {
        const utc = date.kind === 1 /* UTC */;
        if (typeof format !== "string") {
            return utc ? date.toUTCString() : date.toLocaleString();
        }
        else if (format.length === 1) {
            switch (format) {
                case "D":
                case "d":
                    return utc ? dateToHalfUTCString(date, "first") : date.toLocaleDateString();
                case "T":
                case "t":
                    return utc ? dateToHalfUTCString(date, "second") : date.toLocaleTimeString();
                case "O":
                case "o":
                    return dateToISOString(date, utc);
                default:
                    throw new Error("Unrecognized Date print format");
            }
        }
        else {
            return dateToStringWithCustomFormat(date, format, utc);
        }
    }
    function toString(date, format, _provider) {
        return date.offset != null
            ? dateToStringWithOffset(date, format)
            : dateToStringWithKind(date, format);
    }

    const fsFormatRegExp = /(^|[^%])%([0+\- ]*)(\*|\d+)?(?:\.(\d+))?(\w)/g;
    function isLessThan(x, y) {
        return compare$1(x, y) < 0;
    }
    function printf(input) {
        return {
            input,
            cont: fsFormat(input),
        };
    }
    function continuePrint(cont, arg) {
        return typeof arg === "string" ? cont(arg) : arg.cont(cont);
    }
    function toText(arg) {
        return continuePrint((x) => x, arg);
    }
    function formatReplacement(rep, flags, padLength, precision, format) {
        let sign = "";
        flags = flags || "";
        format = format || "";
        if (isNumeric(rep)) {
            if (format.toLowerCase() !== "x") {
                if (isLessThan(rep, 0)) {
                    rep = multiply$1(rep, -1);
                    sign = "-";
                }
                else {
                    if (flags.indexOf(" ") >= 0) {
                        sign = " ";
                    }
                    else if (flags.indexOf("+") >= 0) {
                        sign = "+";
                    }
                }
            }
            precision = precision == null ? null : parseInt(precision, 10);
            switch (format) {
                case "f":
                case "F":
                    precision = precision != null ? precision : 6;
                    rep = toFixed(rep, precision);
                    break;
                case "g":
                case "G":
                    rep = precision != null ? toPrecision(rep, precision) : toPrecision(rep);
                    break;
                case "e":
                case "E":
                    rep = precision != null ? toExponential(rep, precision) : toExponential(rep);
                    break;
                case "x":
                    rep = toHex(rep);
                    break;
                case "X":
                    rep = toHex(rep).toUpperCase();
                    break;
                default: // AOid
                    rep = String(rep);
                    break;
            }
        }
        else if (rep instanceof Date) {
            rep = toString(rep);
        }
        else {
            rep = toString$2(rep);
        }
        padLength = typeof padLength === "number" ? padLength : parseInt(padLength, 10);
        if (!isNaN(padLength)) {
            const zeroFlag = flags.indexOf("0") >= 0; // Use '0' for left padding
            const minusFlag = flags.indexOf("-") >= 0; // Right padding
            const ch = minusFlag || !zeroFlag ? " " : "0";
            if (ch === "0") {
                rep = padLeft(rep, padLength - sign.length, ch, minusFlag);
                rep = sign + rep;
            }
            else {
                rep = padLeft(sign + rep, padLength, ch, minusFlag);
            }
        }
        else {
            rep = sign + rep;
        }
        return rep;
    }
    function createPrinter(cont, _strParts, _matches, _result = "", padArg = -1) {
        return (...args) => {
            // Make copies of the values passed by reference because the function can be used multiple times
            let result = _result;
            const strParts = _strParts.slice();
            const matches = _matches.slice();
            for (const arg of args) {
                const [, , flags, _padLength, precision, format] = matches[0];
                let padLength = _padLength;
                if (padArg >= 0) {
                    padLength = padArg;
                    padArg = -1;
                }
                else if (padLength === "*") {
                    if (arg < 0) {
                        throw new Error("Non-negative number required");
                    }
                    padArg = arg;
                    continue;
                }
                result += strParts[0];
                result += formatReplacement(arg, flags, padLength, precision, format);
                strParts.splice(0, 1);
                matches.splice(0, 1);
            }
            if (matches.length === 0) {
                result += strParts[0];
                return cont(result);
            }
            else {
                return createPrinter(cont, strParts, matches, result, padArg);
            }
        };
    }
    function fsFormat(str) {
        return (cont) => {
            fsFormatRegExp.lastIndex = 0;
            const strParts = [];
            const matches = [];
            let strIdx = 0;
            let match = fsFormatRegExp.exec(str);
            while (match) {
                // The first group corresponds to the no-escape char (^|[^%]), the actual pattern starts in the next char
                // Note: we don't use negative lookbehind because some browsers don't support it yet
                const matchIndex = match.index + (match[1] || "").length;
                strParts.push(str.substring(strIdx, matchIndex).replace(/%%/g, "%"));
                matches.push(match);
                strIdx = fsFormatRegExp.lastIndex;
                // Likewise we need to move fsFormatRegExp.lastIndex one char behind to make sure we match the no-escape char next time
                fsFormatRegExp.lastIndex -= 1;
                match = fsFormatRegExp.exec(str);
            }
            if (strParts.length === 0) {
                return cont(str.replace(/%%/g, "%"));
            }
            else {
                strParts.push(str.substring(strIdx).replace(/%%/g, "%"));
                return createPrinter(cont, strParts, matches);
            }
        };
    }
    function join(delimiter, xs) {
        if (Array.isArray(xs)) {
            return xs.join(delimiter);
        }
        else {
            return Array.from(xs).join(delimiter);
        }
    }
    function padLeft(str, len, ch, isRight) {
        ch = ch || " ";
        len = len - str.length;
        for (let i = 0; i < len; i++) {
            str = isRight ? str + ch : ch + str;
        }
        return str;
    }

    const SR_inputListWasEmpty = "List was empty";

    class FSharpList extends Record {
        constructor(head, tail) {
            super();
            this.head = head;
            this.tail = tail;
        }
        toString() {
            const xs = this;
            return ("[" + join("; ", xs)) + "]";
        }
        Equals(other) {
            const xs = this;
            if (xs === other) {
                return true;
            }
            else {
                const loop = (xs_1_mut, ys_1_mut) => {
                    loop:
                    while (true) {
                        const xs_1 = xs_1_mut, ys_1 = ys_1_mut;
                        const matchValue = [xs_1.tail, ys_1.tail];
                        if (matchValue[0] != null) {
                            if (matchValue[1] != null) {
                                const xt = matchValue[0];
                                const yt = matchValue[1];
                                if (equals$1(xs_1.head, ys_1.head)) {
                                    xs_1_mut = xt;
                                    ys_1_mut = yt;
                                    continue loop;
                                }
                                else {
                                    return false;
                                }
                            }
                            else {
                                return false;
                            }
                        }
                        else if (matchValue[1] != null) {
                            return false;
                        }
                        else {
                            return true;
                        }
                    }
                };
                return loop(xs, other);
            }
        }
        GetHashCode() {
            const xs = this;
            const loop = (i_mut, h_mut, xs_1_mut) => {
                loop:
                while (true) {
                    const i = i_mut, h = h_mut, xs_1 = xs_1_mut;
                    const matchValue = xs_1.tail;
                    if (matchValue != null) {
                        const t = matchValue;
                        if (i > 18) {
                            return h | 0;
                        }
                        else {
                            i_mut = (i + 1);
                            h_mut = (((h << 1) + structuralHash(xs_1.head)) + (631 * i));
                            xs_1_mut = t;
                            continue loop;
                        }
                    }
                    else {
                        return h | 0;
                    }
                }
            };
            return loop(0, 0, xs) | 0;
        }
        toJSON(_key) {
            const this$ = this;
            return Array.from(this$);
        }
        CompareTo(other) {
            const xs = this;
            const loop = (xs_1_mut, ys_1_mut) => {
                loop:
                while (true) {
                    const xs_1 = xs_1_mut, ys_1 = ys_1_mut;
                    const matchValue = [xs_1.tail, ys_1.tail];
                    if (matchValue[0] != null) {
                        if (matchValue[1] != null) {
                            const xt = matchValue[0];
                            const yt = matchValue[1];
                            const c = compare$2(xs_1.head, ys_1.head) | 0;
                            if (c === 0) {
                                xs_1_mut = xt;
                                ys_1_mut = yt;
                                continue loop;
                            }
                            else {
                                return c | 0;
                            }
                        }
                        else {
                            return 1;
                        }
                    }
                    else if (matchValue[1] != null) {
                        return -1;
                    }
                    else {
                        return 0;
                    }
                }
            };
            return loop(xs, other) | 0;
        }
        GetEnumerator() {
            const xs = this;
            return ListEnumerator$1_$ctor_3002E699(xs);
        }
        [Symbol.iterator]() {
            return toIterator(this.GetEnumerator());
        }
        ["System.Collections.IEnumerable.GetEnumerator"]() {
            const xs = this;
            return getEnumerator(xs);
        }
    }

    class ListEnumerator$1 {
        constructor(xs) {
            this.xs = xs;
            this.it = this.xs;
            this.current = null;
        }
        ["System.Collections.Generic.IEnumerator`1.get_Current"]() {
            const __ = this;
            return __.current;
        }
        ["System.Collections.IEnumerator.get_Current"]() {
            const __ = this;
            return __.current;
        }
        ["System.Collections.IEnumerator.MoveNext"]() {
            const __ = this;
            const matchValue = __.it.tail;
            if (matchValue != null) {
                const t = matchValue;
                __.current = __.it.head;
                __.it = t;
                return true;
            }
            else {
                return false;
            }
        }
        ["System.Collections.IEnumerator.Reset"]() {
            const __ = this;
            __.it = __.xs;
            __.current = null;
        }
        Dispose() {
        }
    }

    function ListEnumerator$1_$ctor_3002E699(xs) {
        return new ListEnumerator$1(xs);
    }

    function FSharpList_get_Empty() {
        return new FSharpList(null, void 0);
    }

    function FSharpList_Cons_305B8EAC(x, xs) {
        return new FSharpList(x, xs);
    }

    function FSharpList__get_IsEmpty(xs) {
        return xs.tail == null;
    }

    function FSharpList__get_Head(xs) {
        const matchValue = xs.tail;
        if (matchValue != null) {
            return xs.head;
        }
        else {
            throw (new Error((SR_inputListWasEmpty + "\\nParameter name: ") + "list"));
        }
    }

    function FSharpList__get_Tail(xs) {
        const matchValue = xs.tail;
        if (matchValue != null) {
            return matchValue;
        }
        else {
            throw (new Error((SR_inputListWasEmpty + "\\nParameter name: ") + "list"));
        }
    }

    function empty() {
        return FSharpList_get_Empty();
    }

    function cons(x, xs) {
        return FSharpList_Cons_305B8EAC(x, xs);
    }

    function singleton(x) {
        return FSharpList_Cons_305B8EAC(x, FSharpList_get_Empty());
    }

    function isEmpty(xs) {
        return FSharpList__get_IsEmpty(xs);
    }

    function head(xs) {
        return FSharpList__get_Head(xs);
    }

    function tail(xs) {
        return FSharpList__get_Tail(xs);
    }

    function fold(folder, state, xs) {
        let acc = state;
        let xs_1 = xs;
        while (!FSharpList__get_IsEmpty(xs_1)) {
            acc = folder(acc, FSharpList__get_Head(xs_1));
            xs_1 = FSharpList__get_Tail(xs_1);
        }
        return acc;
    }

    function reverse(xs) {
        return fold((acc, x) => FSharpList_Cons_305B8EAC(x, acc), FSharpList_get_Empty(), xs);
    }

    function ofArrayWithTail(xs, tail_1) {
        let res = tail_1;
        for (let i = xs.length - 1; i >= 0; i--) {
            res = FSharpList_Cons_305B8EAC(xs[i], res);
        }
        return res;
    }

    function ofArray(xs) {
        return ofArrayWithTail(xs, FSharpList_get_Empty());
    }

    function ofSeq(xs) {
        let xs_3, t;
        if (isArrayLike(xs)) {
            return ofArray(xs);
        }
        else if (xs instanceof FSharpList) {
            return xs;
        }
        else {
            const root = FSharpList_get_Empty();
            let node = root;
            const enumerator = getEnumerator(xs);
            try {
                while (enumerator["System.Collections.IEnumerator.MoveNext"]()) {
                    const x = enumerator["System.Collections.Generic.IEnumerator`1.get_Current"]();
                    node = ((xs_3 = node, (t = (new FSharpList(x, void 0)), (xs_3.tail = t, t))));
                }
            }
            finally {
                enumerator.Dispose();
            }
            const xs_5 = node;
            const t_2 = FSharpList_get_Empty();
            xs_5.tail = t_2;
            return FSharpList__get_Tail(root);
        }
    }

    function append(xs, ys) {
        return fold((acc, x) => FSharpList_Cons_305B8EAC(x, acc), ys, reverse(xs));
    }

    class Token extends Union {
        constructor(tag, ...fields) {
            super();
            this.tag = (tag | 0);
            this.fields = fields;
        }
        cases() {
            return ["L_BRACK", "R_BRACK", "IDENT", "COMMA", "OR", "AND", "NOT", "IMP", "BIMP"];
        }
    }

    function format_token(token) {
        switch (token.tag) {
            case 1: {
                return ")";
            }
            case 2: {
                const v = token.fields[0];
                return v;
            }
            case 3: {
                return ",";
            }
            case 4: {
                return "∪";
            }
            case 5: {
                return "∩";
            }
            case 6: {
                return "¬";
            }
            case 7: {
                return "→";
            }
            case 8: {
                return "↔";
            }
            default: {
                return "(";
            }
        }
    }

    class TokenAssoc extends Union {
        constructor(tag, ...fields) {
            super();
            this.tag = (tag | 0);
            this.fields = fields;
        }
        cases() {
            return ["LEFT", "RIGHT", "NA"];
        }
    }

    class TokenArity extends Union {
        constructor(tag, ...fields) {
            super();
            this.tag = (tag | 0);
            this.fields = fields;
        }
        cases() {
            return ["UNARY", "BINARY", "NA"];
        }
    }

    class TokenData extends Union {
        constructor(tag, ...fields) {
            super();
            this.tag = (tag | 0);
            this.fields = fields;
        }
        cases() {
            return ["TokenData"];
        }
    }

    function token_data(token_type) {
        switch (token_type.tag) {
            case 1: {
                return new TokenData(0, new TokenAssoc(2), -1, new TokenArity(2));
            }
            case 2: {
                return new TokenData(0, new TokenAssoc(2), -1, new TokenArity(2));
            }
            case 3: {
                return new TokenData(0, new TokenAssoc(1), 1, new TokenArity(1));
            }
            case 4: {
                return new TokenData(0, new TokenAssoc(0), 2, new TokenArity(1));
            }
            case 5: {
                return new TokenData(0, new TokenAssoc(0), 3, new TokenArity(1));
            }
            case 6: {
                return new TokenData(0, new TokenAssoc(1), 6, new TokenArity(0));
            }
            case 7: {
                return new TokenData(0, new TokenAssoc(0), 4, new TokenArity(1));
            }
            case 8: {
                return new TokenData(0, new TokenAssoc(0), 5, new TokenArity(1));
            }
            default: {
                return new TokenData(0, new TokenAssoc(2), -1, new TokenArity(2));
            }
        }
    }

    function token_assoc(token_type) {
        const assoc = token_data(token_type).fields[0];
        return assoc;
    }

    function token_prec(token_type) {
        const prec = token_data(token_type).fields[1] | 0;
        return prec | 0;
    }

    function token_arity(token_type) {
        const arity = token_data(token_type).fields[2];
        return arity;
    }

    function tokenize(char_stream_mut) {
        let c;
        tokenize:
        while (true) {
            const char_stream = char_stream_mut;
            if (!isEmpty(char_stream)) {
                const t = tail(char_stream);
                const h = head(char_stream);
                if (h === "\t") {
                    char_stream_mut = t;
                    continue tokenize;
                }
                else if (h === "\n") {
                    char_stream_mut = t;
                    continue tokenize;
                }
                else if (h === "\r") {
                    char_stream_mut = t;
                    continue tokenize;
                }
                else if (h === " ") {
                    char_stream_mut = t;
                    continue tokenize;
                }
                else if (h === "(") {
                    return cons(new Token(0), tokenize(t));
                }
                else if (h === ")") {
                    return cons(new Token(1), tokenize(t));
                }
                else if ((c = h, (c <= "z") ? (c >= "a") : false)) {
                    const c_1 = h;
                    return cons(new Token(2, c_1), tokenize(t));
                }
                else {
                    switch (h) {
                        case "\u0026": {
                            return cons(new Token(5), tokenize(t));
                        }
                        case ",": {
                            return cons(new Token(3), tokenize(t));
                        }
                        case "-": {
                            if (!isEmpty(t)) {
                                const t_1 = tail(t);
                                const h_1 = head(t);
                                if (h_1 === "\u003e") {
                                    return cons(new Token(7), tokenize(t_1));
                                }
                                else {
                                    throw (new Error(toText(printf("unexpected character %c"))(h_1)));
                                }
                            }
                            else {
                                throw (new Error(toText(printf("unexpected character %c"))(h)));
                            }
                        }
                        case "\u003c": {
                            if (!isEmpty(t)) {
                                const t_2 = tail(t);
                                const h_2 = head(t);
                                if (h_2 === "-") {
                                    if (!isEmpty(t_2)) {
                                        const t_3 = tail(t_2);
                                        const h_3 = head(t_2);
                                        if (h_3 === "\u003e") {
                                            return cons(new Token(8), tokenize(t_3));
                                        }
                                        else {
                                            throw (new Error(toText(printf("unexpected character %c"))(h_3)));
                                        }
                                    }
                                    else {
                                        throw (new Error(toText(printf("unexpected character %c"))(h_2)));
                                    }
                                }
                                else {
                                    throw (new Error(toText(printf("unexpected character %c"))(h_2)));
                                }
                            }
                            else {
                                throw (new Error(toText(printf("unexpected character %c"))(h)));
                            }
                        }
                        case "|": {
                            return cons(new Token(4), tokenize(t));
                        }
                        case "~": {
                            return cons(new Token(6), tokenize(t));
                        }
                        default: {
                            throw (new Error(toText(printf("unexpected character %c"))(h)));
                        }
                    }
                }
            }
            else {
                return empty();
            }
        }
    }

    function toList(xs) {
        if (isArrayLike(xs)) {
            return ofArray(xs);
        }
        else if (xs instanceof FSharpList) {
            return xs;
        }
        else {
            return ofSeq(xs);
        }
    }

    class Node$ extends Union {
        constructor(tag, ...fields) {
            super();
            this.tag = (tag | 0);
            this.fields = fields;
        }
        cases() {
            return ["UnaryNode", "BinaryNode", "AtomNode"];
        }
    }

    function parse_helper(stack_mut, op_stack_mut, token_stream_mut) {
        parse_helper:
        while (true) {
            const stack = stack_mut, op_stack = op_stack_mut, token_stream = token_stream_mut;
            if (!isEmpty(token_stream)) {
                const t_1 = tail(token_stream);
                const op_1 = head(token_stream);
                switch (op_1.tag) {
                    case 2: {
                        stack_mut = cons(new Node$(2, op_1), stack);
                        op_stack_mut = op_stack;
                        token_stream_mut = t_1;
                        continue parse_helper;
                    }
                    case 0: {
                        stack_mut = stack;
                        op_stack_mut = cons(op_1, op_stack);
                        token_stream_mut = t_1;
                        continue parse_helper;
                    }
                    case 1: {
                        if (!isEmpty(op_stack)) {
                            if (equals$1(token_arity(head(op_stack)), new TokenArity(0))) {
                                stack_mut = cons(new Node$(0, head(op_stack), head(stack)), tail(stack));
                                op_stack_mut = tail(op_stack);
                                token_stream_mut = cons(op_1, t_1);
                                continue parse_helper;
                            }
                            else {
                                let pattern_matching_result, op_op_3, op_t_3;
                                if (!isEmpty(op_stack)) {
                                    if (equals$1(token_arity(head(op_stack)), new TokenArity(1))) {
                                        pattern_matching_result = 0;
                                        op_op_3 = head(op_stack);
                                        op_t_3 = tail(op_stack);
                                    }
                                    else {
                                        pattern_matching_result = 1;
                                    }
                                }
                                else {
                                    pattern_matching_result = 1;
                                }
                                switch (pattern_matching_result) {
                                    case 0: {
                                        const right_1 = head(stack);
                                        stack_mut = cons(new Node$(1, op_op_3, head(tail(stack)), right_1), tail(tail(stack)));
                                        op_stack_mut = op_t_3;
                                        token_stream_mut = cons(op_1, t_1);
                                        continue parse_helper;
                                    }
                                    case 1: {
                                        let pattern_matching_result_1, op_t_4;
                                        if (!isEmpty(op_stack)) {
                                            if (head(op_stack).tag === 0) {
                                                pattern_matching_result_1 = 0;
                                                op_t_4 = tail(op_stack);
                                            }
                                            else {
                                                pattern_matching_result_1 = 1;
                                            }
                                        }
                                        else {
                                            pattern_matching_result_1 = 1;
                                        }
                                        switch (pattern_matching_result_1) {
                                            case 0: {
                                                stack_mut = stack;
                                                op_stack_mut = op_t_4;
                                                token_stream_mut = t_1;
                                                continue parse_helper;
                                            }
                                            case 1: {
                                                throw (new Error("unexpected )"));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        else {
                            throw (new Error("unexpected )"));
                        }
                    }
                    default: {
                        const matchValue_1 = token_assoc(op_1);
                        switch (matchValue_1.tag) {
                            case 0: {
                                let pattern_matching_result_2, op_op_5, op_t_6;
                                if (!isEmpty(op_stack)) {
                                    if (token_prec(op_1) <= token_prec(head(op_stack))) {
                                        pattern_matching_result_2 = 0;
                                        op_op_5 = head(op_stack);
                                        op_t_6 = tail(op_stack);
                                    }
                                    else {
                                        pattern_matching_result_2 = 1;
                                    }
                                }
                                else {
                                    pattern_matching_result_2 = 1;
                                }
                                switch (pattern_matching_result_2) {
                                    case 0: {
                                        const matchValue_2 = token_arity(op_op_5);
                                        switch (matchValue_2.tag) {
                                            case 1: {
                                                const right_2 = head(stack);
                                                stack_mut = cons(new Node$(1, op_op_5, head(tail(stack)), right_2), tail(tail(stack)));
                                                op_stack_mut = op_t_6;
                                                token_stream_mut = cons(op_1, t_1);
                                                continue parse_helper;
                                            }
                                            case 2: {
                                                throw (new Error("unexpected token"));
                                            }
                                            default: {
                                                stack_mut = cons(new Node$(0, op_op_5, head(stack)), tail(stack));
                                                op_stack_mut = op_t_6;
                                                token_stream_mut = cons(op_1, t_1);
                                                continue parse_helper;
                                            }
                                        }
                                    }
                                    case 1: {
                                        let pattern_matching_result_3;
                                        if (isEmpty(op_stack)) {
                                            pattern_matching_result_3 = 0;
                                        }
                                        else if (head(op_stack).tag === 0) {
                                            pattern_matching_result_3 = 0;
                                        }
                                        else if (token_prec(op_1) > token_prec(head(op_stack))) {
                                            pattern_matching_result_3 = 1;
                                        }
                                        else {
                                            pattern_matching_result_3 = 2;
                                        }
                                        switch (pattern_matching_result_3) {
                                            case 0: {
                                                stack_mut = stack;
                                                op_stack_mut = cons(op_1, op_stack);
                                                token_stream_mut = t_1;
                                                continue parse_helper;
                                            }
                                            case 1: {
                                                stack_mut = stack;
                                                op_stack_mut = cons(op_1, op_stack);
                                                token_stream_mut = t_1;
                                                continue parse_helper;
                                            }
                                            case 2: {
                                                throw (new Error("unexpected operator"));
                                            }
                                        }
                                    }
                                }
                            }
                            case 1: {
                                let pattern_matching_result_4, op_op_9, op_t_10;
                                if (!isEmpty(op_stack)) {
                                    if (token_prec(op_1) < token_prec(head(op_stack))) {
                                        pattern_matching_result_4 = 0;
                                        op_op_9 = head(op_stack);
                                        op_t_10 = tail(op_stack);
                                    }
                                    else {
                                        pattern_matching_result_4 = 1;
                                    }
                                }
                                else {
                                    pattern_matching_result_4 = 1;
                                }
                                switch (pattern_matching_result_4) {
                                    case 0: {
                                        const matchValue_3 = token_arity(op_op_9);
                                        switch (matchValue_3.tag) {
                                            case 0: {
                                                stack_mut = cons(new Node$(0, op_op_9, head(stack)), tail(stack));
                                                op_stack_mut = op_t_10;
                                                token_stream_mut = cons(op_1, t_1);
                                                continue parse_helper;
                                            }
                                            case 1: {
                                                const right_3 = head(stack);
                                                stack_mut = cons(new Node$(1, op_op_9, head(tail(stack)), right_3), tail(tail(stack)));
                                                op_stack_mut = op_t_10;
                                                token_stream_mut = cons(op_1, t_1);
                                                continue parse_helper;
                                            }
                                            default: {
                                                throw (new Error("unexpected token"));
                                            }
                                        }
                                    }
                                    case 1: {
                                        let pattern_matching_result_5;
                                        if (isEmpty(op_stack)) {
                                            pattern_matching_result_5 = 0;
                                        }
                                        else if (head(op_stack).tag === 0) {
                                            pattern_matching_result_5 = 0;
                                        }
                                        else if (token_prec(op_1) >= token_prec(head(op_stack))) {
                                            pattern_matching_result_5 = 1;
                                        }
                                        else {
                                            pattern_matching_result_5 = 2;
                                        }
                                        switch (pattern_matching_result_5) {
                                            case 0: {
                                                stack_mut = stack;
                                                op_stack_mut = cons(op_1, op_stack);
                                                token_stream_mut = t_1;
                                                continue parse_helper;
                                            }
                                            case 1: {
                                                stack_mut = stack;
                                                op_stack_mut = cons(op_1, op_stack);
                                                token_stream_mut = t_1;
                                                continue parse_helper;
                                            }
                                            case 2: {
                                                throw (new Error("unexpected operator"));
                                            }
                                        }
                                    }
                                }
                            }
                            default: {
                                throw (new Error("unexpected operator"));
                            }
                        }
                    }
                }
            }
            else if (!isEmpty(op_stack)) {
                const t = tail(op_stack);
                const op = head(op_stack);
                const matchValue = token_arity(op);
                switch (matchValue.tag) {
                    case 1: {
                        const right = head(stack);
                        stack_mut = cons(new Node$(1, op, head(tail(stack)), right), tail(tail(stack)));
                        op_stack_mut = t;
                        token_stream_mut = empty();
                        continue parse_helper;
                    }
                    case 2: {
                        throw (new Error("unexpected token"));
                    }
                    default: {
                        stack_mut = cons(new Node$(0, op, head(stack)), tail(stack));
                        op_stack_mut = t;
                        token_stream_mut = empty();
                        continue parse_helper;
                    }
                }
            }
            else {
                return head(stack);
            }
            break;
        }
    }

    function parse(token_stream) {
        return parse_helper(empty(), empty(), token_stream);
    }

    function node_prec(node) {
        return token_prec((node.tag === 1) ? node.fields[0] : ((node.tag === 2) ? node.fields[0] : node.fields[0]));
    }

    function node_print(node) {
        let op_prec_1, op_prec_2, op_prec;
        const prec = node_prec(node) | 0;
        let pattern_matching_result, op_1, operand_1;
        if (node.tag === 0) {
            if ((op_prec = (node_prec(node.fields[1]) | 0), (prec > op_prec) ? (op_prec > 0) : false)) {
                pattern_matching_result = 0;
                op_1 = node.fields[0];
                operand_1 = node.fields[1];
            }
            else {
                pattern_matching_result = 1;
            }
        }
        else {
            pattern_matching_result = 1;
        }
        switch (pattern_matching_result) {
            case 0: {
                const arg20 = node_print(operand_1);
                const arg10 = format_token(op_1);
                return toText(printf("%s(%s)"))(arg10)(arg20);
            }
            case 1: {
                switch (node.tag) {
                    case 1: {
                        const right = node.fields[2];
                        const left = node.fields[1];
                        let ls;
                        if ((op_prec_1 = (node_prec(left) | 0), (prec > op_prec_1) ? (op_prec_1 > 0) : false)) {
                            const arg10_2 = node_print(left);
                            ls = toText(printf("(%s)"))(arg10_2);
                        }
                        else {
                            ls = node_print(left);
                        }
                        let rs;
                        if ((op_prec_2 = (node_prec(right) | 0), (prec > op_prec_2) ? (op_prec_2 > 0) : false)) {
                            const arg10_3 = node_print(right);
                            rs = toText(printf("(%s)"))(arg10_3);
                        }
                        else {
                            rs = node_print(right);
                        }
                        const arg20_2 = format_token(node.fields[0]);
                        return toText(printf("%s%s%s"))(ls)(arg20_2)(rs);
                    }
                    case 2: {
                        const arg10_5 = format_token(node.fields[0]);
                        return toText(printf("%s"))(arg10_5);
                    }
                    default: {
                        const arg20_1 = node_print(node.fields[1]);
                        const arg10_1 = format_token(node.fields[0]);
                        return toText(printf("%s%s"))(arg10_1)(arg20_1);
                    }
                }
            }
        }
    }

    function rev(list) {
        const loop = (acc_mut, _arg1_mut) => {
            loop:
            while (true) {
                const acc = acc_mut, _arg1 = _arg1_mut;
                if (!isEmpty(_arg1)) {
                    acc_mut = cons(head(_arg1), acc);
                    _arg1_mut = tail(_arg1);
                    continue loop;
                }
                else {
                    return acc;
                }
            }
        };
        return loop(empty(), list);
    }

    class ProofLine extends Union {
        constructor(tag, ...fields) {
            super();
            this.tag = (tag | 0);
            this.fields = fields;
        }
        cases() {
            return ["PropositionLine", "NegElimLine", "AlphaLine", "BetaLine", "EtaLine", "OpenLine", "CloseLine", "BranchLine"];
        }
    }

    class ProofTree extends Union {
        constructor(tag, ...fields) {
            super();
            this.tag = (tag | 0);
            this.fields = fields;
        }
        cases() {
            return ["End", "Continuous", "Branch"];
        }
    }

    class ProofBranchLine extends Union {
        constructor(tag, ...fields) {
            super();
            this.tag = (tag | 0);
            this.fields = fields;
        }
        cases() {
            return ["Root", "Line"];
        }
    }

    function get_line(line) {
        switch (line.tag) {
            case 1: {
                const ln_1 = line.fields[0] | 0;
                return ln_1 | 0;
            }
            case 2: {
                const ln_2 = line.fields[0] | 0;
                return ln_2 | 0;
            }
            case 3: {
                const ln_3 = line.fields[0] | 0;
                return ln_3 | 0;
            }
            case 4: {
                const ln_4 = line.fields[0] | 0;
                return ln_4 | 0;
            }
            case 5: {
                const ln_5 = line.fields[0] | 0;
                return ln_5 | 0;
            }
            case 6: {
                const ln_6 = line.fields[0] | 0;
                return ln_6 | 0;
            }
            case 7: {
                const ln_7 = line.fields[0] | 0;
                return ln_7 | 0;
            }
            default: {
                const ln = line.fields[0] | 0;
                return ln | 0;
            }
        }
    }

    function print_format_line(tab, formula) {
        if (tab === 0) {
            switch (formula.tag) {
                case 1: {
                    const src = formula.fields[1];
                    const node_1 = formula.fields[2];
                    const ln_1 = formula.fields[0] | 0;
                    const src_ln = get_line(src) | 0;
                    const arg30 = node_print(node_1);
                    return toText(printf("%d: \u003cDNE %d\u003e: %s\n"))(ln_1)(src_ln)(arg30);
                }
                case 2: {
                    const src_1 = formula.fields[1];
                    const node_2 = formula.fields[2];
                    const ln_2 = formula.fields[0] | 0;
                    const src_ln_1 = get_line(src_1) | 0;
                    const arg30_1 = node_print(node_2);
                    return toText(printf("%d: \u003cA %d\u003e: %s\n"))(ln_2)(src_ln_1)(arg30_1);
                }
                case 3: {
                    const node_3 = formula.fields[3];
                    const ln_3 = formula.fields[0] | 0;
                    const beta_min = formula.fields[2];
                    const beta_max = formula.fields[1];
                    const bmax_ln = get_line(beta_max) | 0;
                    const bmin_ln = get_line(beta_min) | 0;
                    const arg40 = node_print(node_3);
                    return toText(printf("%d: \u003cB %d %d\u003e: %s\n"))(ln_3)(bmax_ln)(bmin_ln)(arg40);
                }
                case 4: {
                    const node_4 = formula.fields[3];
                    const ln_4 = formula.fields[0] | 0;
                    const eta_min = formula.fields[2];
                    const eta_max = formula.fields[1];
                    const emax_ln = get_line(eta_max) | 0;
                    const emin_ln = get_line(eta_min) | 0;
                    const arg40_1 = node_print(node_4);
                    return toText(printf("%d: \u003cE %d %d\u003e: %s\n"))(ln_4)(emax_ln)(emin_ln)(arg40_1);
                }
                case 5: {
                    const ln_5 = formula.fields[0] | 0;
                    return toText(printf("%d: \u003cO\u003e\n\n"))(ln_5);
                }
                case 6: {
                    const ln_6 = formula.fields[0] | 0;
                    const close_min = formula.fields[2];
                    const close_max = formula.fields[1];
                    const cmax_ln = get_line(close_max) | 0;
                    const cmin_ln = get_line(close_min) | 0;
                    return toText(printf("%d: \u003cC %d %d\u003e\n\n"))(ln_6)(cmax_ln)(cmin_ln);
                }
                case 7: {
                    const node_5 = formula.fields[1];
                    const ln_7 = formula.fields[0] | 0;
                    const arg20_6 = node_print(node_5);
                    return toText(printf("%d: \u003cB\u003e: %s\n"))(ln_7)(arg20_6);
                }
                default: {
                    const node = formula.fields[1];
                    const ln = formula.fields[0] | 0;
                    const arg20 = node_print(node);
                    return toText(printf("%d: \u003cP\u003e: %s\n"))(ln)(arg20);
                }
            }
        }
        else {
            const tab_1 = tab | 0;
            const arg10_8 = print_format_line(tab_1 - 1, formula);
            return toText(printf(" %s"))(arg10_8);
        }
    }

    function print_format_tree(tab, tree) {
        switch (tree.tag) {
            case 1: {
                const tree_1 = tree.fields[1];
                const line_1 = tree.fields[0];
                const arg20 = print_format_tree(tab, tree_1);
                const arg10 = print_format_line(tab, line_1);
                return toText(printf("%s%s"))(arg10)(arg20);
            }
            case 2: {
                const right = tree.fields[1];
                const left = tree.fields[0];
                const arg20_1 = print_format_tree(tab + 1, right);
                const arg10_1 = print_format_tree(tab + 1, left);
                return toText(printf("%s%s"))(arg10_1)(arg20_1);
            }
            default: {
                const line = tree.fields[0];
                return print_format_line(tab, line);
            }
        }
    }

    function print_tree(tree) {
        return print_format_tree(0, tree);
    }

    function json_from_tree_line(formula) {
        switch (formula.tag) {
            case 1: {
                const src = formula.fields[1];
                const node_1 = formula.fields[2];
                const ln_1 = formula.fields[0] | 0;
                const src_ln = get_line(src) | 0;
                const arg30 = node_print(node_1);
                return toText(printf("{type: \"ne\", ln: %d, src: %d, formula: \"%s\"}"))(ln_1)(src_ln)(arg30);
            }
            case 2: {
                const src_1 = formula.fields[1];
                const node_2 = formula.fields[2];
                const ln_2 = formula.fields[0] | 0;
                const src_ln_1 = get_line(src_1) | 0;
                const arg30_1 = node_print(node_2);
                return toText(printf("{type: \"a\", ln: %d, src: %d, formula: \"%s\"}"))(ln_2)(src_ln_1)(arg30_1);
            }
            case 3: {
                const node_3 = formula.fields[3];
                const ln_3 = formula.fields[0] | 0;
                const beta_min = formula.fields[2];
                const beta_max = formula.fields[1];
                const bmax_ln = get_line(beta_max) | 0;
                const bmin_ln = get_line(beta_min) | 0;
                const arg40 = node_print(node_3);
                return toText(printf("{type: \"b\", ln: %d, src: %d, min_src: %d, formula: \"%s\"}"))(ln_3)(bmax_ln)(bmin_ln)(arg40);
            }
            case 4: {
                const node_4 = formula.fields[3];
                const ln_4 = formula.fields[0] | 0;
                const eta_min = formula.fields[2];
                const eta_max = formula.fields[1];
                const emax_ln = get_line(eta_max) | 0;
                const emin_ln = get_line(eta_min) | 0;
                const arg40_1 = node_print(node_4);
                return toText(printf("{type: \"e\", ln: %d, src: %d, min_src: %d, formula: \"%s\"}"))(ln_4)(emax_ln)(emin_ln)(arg40_1);
            }
            case 5: {
                const ln_5 = formula.fields[0] | 0;
                return toText(printf("{type: \"o\", ln: %d}"))(ln_5);
            }
            case 6: {
                const ln_6 = formula.fields[0] | 0;
                const close_min = formula.fields[2];
                const close_max = formula.fields[1];
                const cmax_ln = get_line(close_max) | 0;
                const cmin_ln = get_line(close_min) | 0;
                return toText(printf("{type: \"c\", ln: %d, src: %d, min_src: %d}"))(ln_6)(cmax_ln)(cmin_ln);
            }
            case 7: {
                const node_5 = formula.fields[1];
                const ln_7 = formula.fields[0] | 0;
                const arg20_6 = node_print(node_5);
                return toText(printf("{type: \"b\", ln: %d, formula: \"%s\"}"))(ln_7)(arg20_6);
            }
            default: {
                const node = formula.fields[1];
                const ln = formula.fields[0] | 0;
                const arg20 = node_print(node);
                return toText(printf("{type: \"p\", ln: %d, formula: \"%s\"}"))(ln)(arg20);
            }
        }
    }

    function json_from_tree_helper(tree) {
        switch (tree.tag) {
            case 1: {
                const tree_1 = tree.fields[1];
                const line_1 = tree.fields[0];
                const arg20 = json_from_tree_helper(tree_1);
                const arg10 = json_from_tree_line(line_1);
                return toText(printf("%s, %s"))(arg10)(arg20);
            }
            case 2: {
                const right = tree.fields[1];
                const left = tree.fields[0];
                const arg20_1 = json_from_tree_helper(right);
                const arg10_1 = json_from_tree_helper(left);
                return toText(printf("{type: \"bc\", left: [%s], right: [%s]}"))(arg10_1)(arg20_1);
            }
            default: {
                const line = tree.fields[0];
                return json_from_tree_line(line);
            }
        }
    }

    function json_from_tree(tree) {
        return ("[" + json_from_tree_helper(tree)) + "]";
    }

    function remove_neg(node_mut) {
        remove_neg:
        while (true) {
            const node = node_mut;
            let pattern_matching_result, operand;
            if (node.tag === 0) {
                if (node.fields[0].tag === 6) {
                    if (node.fields[1].tag === 0) {
                        if (node.fields[1].fields[0].tag === 6) {
                            pattern_matching_result = 0;
                            operand = node.fields[1].fields[1];
                        }
                        else {
                            pattern_matching_result = 1;
                        }
                    }
                    else {
                        pattern_matching_result = 1;
                    }
                }
                else {
                    pattern_matching_result = 1;
                }
            }
            else {
                pattern_matching_result = 1;
            }
            switch (pattern_matching_result) {
                case 0: {
                    node_mut = operand;
                    continue remove_neg;
                }
                case 1: {
                    return node;
                }
            }
            break;
        }
    }

    function negate(node) {
        return remove_neg(new Node$(0, new Token(6), node));
    }

    function in_branch(node_mut, line_mut) {
        let l_node_10, l_node_8, l_node_6, l_node_4, l_node_2, l_node;
        in_branch:
        while (true) {
            const node = node_mut, line = line_mut;
            let pattern_matching_result, l_node_1, ln_1;
            if (line.tag === 1) {
                if (line.fields[0].tag === 0) {
                    if (((line.fields[0].fields[0] | 0), (l_node = line.fields[0].fields[1], equals$1(l_node, node)))) {
                        pattern_matching_result = 1;
                        l_node_1 = line.fields[0].fields[1];
                        ln_1 = line.fields[0].fields[0];
                    }
                    else {
                        pattern_matching_result = 2;
                    }
                }
                else {
                    pattern_matching_result = 2;
                }
            }
            else {
                pattern_matching_result = 0;
            }
            switch (pattern_matching_result) {
                case 0: {
                    return void 0;
                }
                case 1: {
                    return new ProofLine(0, ln_1, l_node_1);
                }
                case 2: {
                    let pattern_matching_result_1, a_1, l_node_3, ln_3;
                    if (line.tag === 1) {
                        if (line.fields[0].tag === 1) {
                            if (((line.fields[0].fields[0] | 0), (l_node_2 = line.fields[0].fields[2], (line.fields[0].fields[1], equals$1(l_node_2, node))))) {
                                pattern_matching_result_1 = 0;
                                a_1 = line.fields[0].fields[1];
                                l_node_3 = line.fields[0].fields[2];
                                ln_3 = line.fields[0].fields[0];
                            }
                            else {
                                pattern_matching_result_1 = 1;
                            }
                        }
                        else {
                            pattern_matching_result_1 = 1;
                        }
                    }
                    else {
                        pattern_matching_result_1 = 1;
                    }
                    switch (pattern_matching_result_1) {
                        case 0: {
                            return new ProofLine(1, ln_3, a_1, l_node_3);
                        }
                        case 1: {
                            let pattern_matching_result_2, a_3, l_node_5, ln_5;
                            if (line.tag === 1) {
                                if (line.fields[0].tag === 2) {
                                    if (((line.fields[0].fields[0] | 0), (l_node_4 = line.fields[0].fields[2], (line.fields[0].fields[1], equals$1(l_node_4, node))))) {
                                        pattern_matching_result_2 = 0;
                                        a_3 = line.fields[0].fields[1];
                                        l_node_5 = line.fields[0].fields[2];
                                        ln_5 = line.fields[0].fields[0];
                                    }
                                    else {
                                        pattern_matching_result_2 = 1;
                                    }
                                }
                                else {
                                    pattern_matching_result_2 = 1;
                                }
                            }
                            else {
                                pattern_matching_result_2 = 1;
                            }
                            switch (pattern_matching_result_2) {
                                case 0: {
                                    return new ProofLine(2, ln_5, a_3, l_node_5);
                                }
                                case 1: {
                                    let pattern_matching_result_3, a_5, b_1, l_node_7, ln_7;
                                    if (line.tag === 1) {
                                        if (line.fields[0].tag === 3) {
                                            if (((line.fields[0].fields[0] | 0), (l_node_6 = line.fields[0].fields[3], (line.fields[0].fields[2], (line.fields[0].fields[1], equals$1(l_node_6, node)))))) {
                                                pattern_matching_result_3 = 0;
                                                a_5 = line.fields[0].fields[1];
                                                b_1 = line.fields[0].fields[2];
                                                l_node_7 = line.fields[0].fields[3];
                                                ln_7 = line.fields[0].fields[0];
                                            }
                                            else {
                                                pattern_matching_result_3 = 1;
                                            }
                                        }
                                        else {
                                            pattern_matching_result_3 = 1;
                                        }
                                    }
                                    else {
                                        pattern_matching_result_3 = 1;
                                    }
                                    switch (pattern_matching_result_3) {
                                        case 0: {
                                            return new ProofLine(3, ln_7, a_5, b_1, l_node_7);
                                        }
                                        case 1: {
                                            let pattern_matching_result_4, a_7, b_3, l_node_9, ln_9;
                                            if (line.tag === 1) {
                                                if (line.fields[0].tag === 4) {
                                                    if (((line.fields[0].fields[0] | 0), (l_node_8 = line.fields[0].fields[3], (line.fields[0].fields[2], (line.fields[0].fields[1], equals$1(l_node_8, node)))))) {
                                                        pattern_matching_result_4 = 0;
                                                        a_7 = line.fields[0].fields[1];
                                                        b_3 = line.fields[0].fields[2];
                                                        l_node_9 = line.fields[0].fields[3];
                                                        ln_9 = line.fields[0].fields[0];
                                                    }
                                                    else {
                                                        pattern_matching_result_4 = 1;
                                                    }
                                                }
                                                else {
                                                    pattern_matching_result_4 = 1;
                                                }
                                            }
                                            else {
                                                pattern_matching_result_4 = 1;
                                            }
                                            switch (pattern_matching_result_4) {
                                                case 0: {
                                                    return new ProofLine(4, ln_9, a_7, b_3, l_node_9);
                                                }
                                                case 1: {
                                                    let pattern_matching_result_5, l_node_11, ln_11;
                                                    if (line.tag === 1) {
                                                        if (line.fields[0].tag === 7) {
                                                            if (((line.fields[0].fields[0] | 0), (l_node_10 = line.fields[0].fields[1], equals$1(l_node_10, node)))) {
                                                                pattern_matching_result_5 = 0;
                                                                l_node_11 = line.fields[0].fields[1];
                                                                ln_11 = line.fields[0].fields[0];
                                                            }
                                                            else {
                                                                pattern_matching_result_5 = 1;
                                                            }
                                                        }
                                                        else {
                                                            pattern_matching_result_5 = 1;
                                                        }
                                                    }
                                                    else {
                                                        pattern_matching_result_5 = 1;
                                                    }
                                                    switch (pattern_matching_result_5) {
                                                        case 0: {
                                                            return new ProofLine(7, ln_11, l_node_11);
                                                        }
                                                        case 1: {
                                                            if (line.tag === 1) {
                                                                const prev = line.fields[1];
                                                                node_mut = node;
                                                                line_mut = prev;
                                                                continue in_branch;
                                                            }
                                                            else {
                                                                throw (new Error("Match failure"));
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            break;
        }
    }

    function neg_in_branch(node, line) {
        return in_branch(negate(node), line);
    }

    function prop_helper(ln_mut, nodes_mut, passed_mut, tree_mut) {
        let op_1;
        prop_helper:
        while (true) {
            const ln = ln_mut, nodes = nodes_mut, passed = passed_mut, tree = tree_mut;
            let prev;
            if (tree.tag === 1) {
                const line = tree.fields[0];
                prev = line;
            }
            else {
                prev = (void 0);
            }
            if (!isEmpty(nodes)) {
                const nodes_1 = tail(nodes);
                const node_1 = head(nodes);
                const matchValue = neg_in_branch(node_1, tree);
                if (matchValue == null) {
                    switch (node_1.tag) {
                        case 0: {
                            const operand = node_1.fields[1];
                            const op_3 = node_1.fields[0];
                            if (op_3.tag === 6) {
                                switch (operand.tag) {
                                    case 0: {
                                        const operand_1 = operand.fields[1];
                                        const op_5 = operand.fields[0];
                                        if (op_5.tag === 6) {
                                            const new_node = remove_neg(operand_1);
                                            let prev_instr_line;
                                            const matchValue_1 = in_branch(node_1, tree);
                                            if (matchValue_1 != null) {
                                                const prev_2 = matchValue_1;
                                                prev_instr_line = prev_2;
                                            }
                                            else {
                                                throw (new Error("This should be unreachable."));
                                            }
                                            const instr = new ProofLine(1, ln, prev_instr_line, new_node);
                                            const down_tree_1 = new ProofBranchLine(1, instr, tree);
                                            const up_tree_1 = prop_helper(ln + 1, cons(new_node, nodes_1), passed, down_tree_1);
                                            return new ProofTree(1, instr, up_tree_1);
                                        }
                                        else {
                                            throw (new Error("This should be unreachable"));
                                        }
                                    }
                                    case 2: {
                                        ln_mut = ln;
                                        nodes_mut = nodes_1;
                                        passed_mut = passed;
                                        tree_mut = tree;
                                        continue prop_helper;
                                    }
                                    default: {
                                        const right_1 = operand.fields[2];
                                        const op_4 = operand.fields[0];
                                        const left_2 = operand.fields[1];
                                        switch (op_4.tag) {
                                            case 3: {
                                                throw (new Error("This should be unreachable."));
                                            }
                                            case 5: {
                                                return beta_helper(ln, nodes_1, passed, tree, node_1, negate(left_2), negate(right_1));
                                            }
                                            case 4: {
                                                return alpha_helper(ln, nodes_1, passed, tree, node_1, negate(left_2), negate(right_1));
                                            }
                                            case 7: {
                                                return alpha_helper(ln, nodes_1, passed, tree, node_1, left_2, negate(right_1));
                                            }
                                            case 8: {
                                                return eta_helper(ln, nodes_1, passed, tree, node_1, left_2, negate(right_1));
                                            }
                                            default: {
                                                throw (new Error("This should be unreachable."));
                                            }
                                        }
                                    }
                                }
                            }
                            else {
                                throw (new Error("This should be unreachable."));
                            }
                        }
                        case 2: {
                            ln_mut = ln;
                            nodes_mut = nodes_1;
                            passed_mut = passed;
                            tree_mut = tree;
                            continue prop_helper;
                        }
                        default: {
                            const right = node_1.fields[2];
                            const op = node_1.fields[0];
                            const left_1 = node_1.fields[1];
                            switch (op.tag) {
                                case 3: {
                                    const instr_line = new ProofLine(0, ln, left_1);
                                    const down_tree = new ProofBranchLine(1, instr_line, tree);
                                    let pattern_matching_result;
                                    if (right.tag === 1) {
                                        if ((op_1 = right.fields[0], equals$1(op_1, new Token(3)))) {
                                            pattern_matching_result = 0;
                                        }
                                        else {
                                            pattern_matching_result = 1;
                                        }
                                    }
                                    else {
                                        pattern_matching_result = 1;
                                    }
                                    switch (pattern_matching_result) {
                                        case 0: {
                                            const next_up_tree = prop_helper(ln + 1, append(nodes_1, singleton(right)), cons(left_1, passed), down_tree);
                                            return new ProofTree(1, instr_line, next_up_tree);
                                        }
                                        case 1: {
                                            const next_instr_line = new ProofLine(0, ln + 1, right);
                                            const next_down_tree = new ProofBranchLine(1, next_instr_line, down_tree);
                                            const up_tree = prop_helper(ln + 2, append(rev(passed), ofArray([left_1, right])), empty(), next_down_tree);
                                            return new ProofTree(1, instr_line, new ProofTree(1, next_instr_line, up_tree));
                                        }
                                    }
                                }
                                case 5: {
                                    return alpha_helper(ln, nodes_1, passed, tree, node_1, left_1, right);
                                }
                                case 4: {
                                    return beta_helper(ln, nodes_1, passed, tree, node_1, left_1, right);
                                }
                                case 7: {
                                    return beta_helper(ln, nodes_1, passed, tree, node_1, negate(left_1), right);
                                }
                                case 8: {
                                    return eta_helper(ln, nodes_1, passed, tree, node_1, left_1, right);
                                }
                                default: {
                                    ln_mut = ln;
                                    nodes_mut = nodes_1;
                                    passed_mut = passed;
                                    tree_mut = tree;
                                    continue prop_helper;
                                }
                            }
                        }
                    }
                }
                else {
                    const line_1 = matchValue;
                    if (prev != null) {
                        const prev_1 = prev;
                        return new ProofTree(0, new ProofLine(6, ln, line_1, prev_1));
                    }
                    else {
                        throw (new Error("This should be unreachable."));
                    }
                }
            }
            else if (!isEmpty(passed)) {
                const node = head(passed);
                if (node.tag === 1) {
                    const left = node.fields[1];
                    const true_branch_line = new ProofLine(7, ln, left);
                    const true_down_tree = new ProofBranchLine(1, true_branch_line, tree);
                    const true_up_tree = prop_helper(ln + 1, passed, empty(), true_down_tree);
                    const true_branch_tree = new ProofTree(1, true_branch_line, true_up_tree);
                    const false_branch_line = new ProofLine(7, ln, negate(left));
                    const false_down_tree = new ProofBranchLine(1, false_branch_line, tree);
                    const false_up_tree = prop_helper(ln + 1, passed, empty(), false_down_tree);
                    const false_branch_tree = new ProofTree(1, false_branch_line, false_up_tree);
                    return new ProofTree(2, true_branch_tree, false_branch_tree);
                }
                else {
                    throw (new Error("This should be unreachable"));
                }
            }
            else {
                return new ProofTree(0, new ProofLine(5, ln));
            }
            break;
        }
    }

    function alpha_helper(ln, nodes, passed, tree, node, left, right) {
        let prev_instr_line;
        const matchValue = in_branch(node, tree);
        if (matchValue != null) {
            const prev = matchValue;
            prev_instr_line = prev;
        }
        else {
            throw (new Error("This should be unreachable."));
        }
        const left_instr = new ProofLine(2, ln, prev_instr_line, left);
        const right_instr = new ProofLine(2, ln + 1, prev_instr_line, right);
        const down_tree = new ProofBranchLine(1, left_instr, new ProofBranchLine(1, right_instr, tree));
        const up_tree = prop_helper(ln + 2, append(ofArrayWithTail([left, right], nodes), passed), empty(), down_tree);
        return new ProofTree(1, left_instr, new ProofTree(1, right_instr, up_tree));
    }

    function beta_helper(ln, nodes, passed, tree, node, left, right) {
        let prev_instr_line;
        const matchValue = in_branch(node, tree);
        if (matchValue != null) {
            const prev = matchValue;
            prev_instr_line = prev;
        }
        else {
            throw (new Error("This should be unreachable."));
        }
        const matchValue_1 = in_branch(left, tree);
        if (matchValue_1 == null) {
            const matchValue_2 = in_branch(right, tree);
            if (matchValue_2 == null) {
                const matchValue_3 = neg_in_branch(left, tree);
                if (matchValue_3 == null) {
                    const matchValue_4 = neg_in_branch(right, tree);
                    if (matchValue_4 == null) {
                        return prop_helper(ln, nodes, cons(node, passed), tree);
                    }
                    else {
                        const right_line = matchValue_4;
                        const left_instr_line = new ProofLine(3, ln, prev_instr_line, right_line, left);
                        const down_tree_1 = new ProofBranchLine(1, left_instr_line, tree);
                        const up_tree_1 = prop_helper(ln + 1, cons(left, nodes), passed, down_tree_1);
                        return new ProofTree(1, left_instr_line, up_tree_1);
                    }
                }
                else {
                    const left_line = matchValue_3;
                    const right_instr_line = new ProofLine(3, ln, prev_instr_line, left_line, right);
                    const down_tree = new ProofBranchLine(1, right_instr_line, tree);
                    const up_tree = prop_helper(ln + 1, cons(right, nodes), passed, down_tree);
                    return new ProofTree(1, right_instr_line, up_tree);
                }
            }
            else {
                return prop_helper(ln, nodes, passed, tree);
            }
        }
        else {
            return prop_helper(ln, nodes, passed, tree);
        }
    }

    function eta_helper(ln, nodes, passed, tree, node, left, right) {
        let prev_instr_line;
        const matchValue = in_branch(node, tree);
        if (matchValue != null) {
            const prev = matchValue;
            prev_instr_line = prev;
        }
        else {
            throw (new Error("This should be unreachable."));
        }
        const matchValue_1 = in_branch(left, tree);
        if (matchValue_1 == null) {
            const matchValue_2 = neg_in_branch(left, tree);
            if (matchValue_2 == null) {
                const matchValue_3 = in_branch(right, tree);
                if (matchValue_3 == null) {
                    const matchValue_4 = neg_in_branch(right, tree);
                    if (matchValue_4 == null) {
                        return prop_helper(ln, nodes, cons(node, passed), tree);
                    }
                    else {
                        const neg_right_line = matchValue_4;
                        const neg_left = negate(left);
                        const neg_right_instr_line = new ProofLine(4, ln, prev_instr_line, neg_right_line, neg_left);
                        const down_tree_3 = new ProofBranchLine(1, neg_right_instr_line, tree);
                        const up_tree_3 = prop_helper(ln + 1, append(cons(neg_left, nodes), passed), empty(), down_tree_3);
                        return new ProofTree(1, neg_right_instr_line, up_tree_3);
                    }
                }
                else {
                    const right_line = matchValue_3;
                    const right_instr_line = new ProofLine(4, ln, prev_instr_line, right_line, left);
                    const down_tree_2 = new ProofBranchLine(1, right_instr_line, tree);
                    const up_tree_2 = prop_helper(ln + 1, append(cons(left, nodes), passed), empty(), down_tree_2);
                    return new ProofTree(1, right_instr_line, up_tree_2);
                }
            }
            else {
                const neg_left_line = matchValue_2;
                const neg_right = negate(right);
                const neg_left_instr_line = new ProofLine(4, ln, prev_instr_line, neg_left_line, neg_right);
                const down_tree_1 = new ProofBranchLine(1, neg_left_instr_line, tree);
                const up_tree_1 = prop_helper(ln + 1, append(cons(neg_right, nodes), passed), empty(), down_tree_1);
                return new ProofTree(1, neg_left_instr_line, up_tree_1);
            }
        }
        else {
            const left_line = matchValue_1;
            const left_instr_line = new ProofLine(4, ln, prev_instr_line, left_line, right);
            const down_tree = new ProofBranchLine(1, left_instr_line, tree);
            const up_tree = prop_helper(ln + 1, append(cons(right, nodes), passed), empty(), down_tree);
            return new ProofTree(1, left_instr_line, up_tree);
        }
    }

    function propopositional_solver(node) {
        let op;
        let pattern_matching_result;
        if (node.tag === 1) {
            if ((node.fields[2], (op = node.fields[0], (node.fields[1], equals$1(op, new Token(3)))))) {
                pattern_matching_result = 0;
            }
            else {
                pattern_matching_result = 1;
            }
        }
        else {
            pattern_matching_result = 1;
        }
        switch (pattern_matching_result) {
            case 0: {
                return prop_helper(0, singleton(node), empty(), new ProofBranchLine(0));
            }
            case 1: {
                const up_tree = prop_helper(1, singleton(node), empty(), new ProofBranchLine(1, new ProofLine(0, 0, node), new ProofBranchLine(0)));
                return new ProofTree(1, new ProofLine(0, 0, node), up_tree);
            }
        }
    }

    function gen_interpretation(input) {
        const tokens = tokenize(toList(input));
        const ast = parse(tokens);
        return node_print(ast);
    }

    function gen_text_tree(input) {
        const tokens = tokenize(toList(input));
        const ast = parse(tokens);
        const proof_tree = propopositional_solver(ast);
        return print_tree(proof_tree);
    }

    function gen_tree(input) {
        const tokens = tokenize(toList(input));
        const ast = parse(tokens);
        const proof_tree = propopositional_solver(ast);
        return json_from_tree(proof_tree);
    }

    exports.gen_interpretation = gen_interpretation;
    exports.gen_text_tree = gen_text_tree;
    exports.gen_tree = gen_tree;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=solver.js.map
