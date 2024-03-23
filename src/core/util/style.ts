/* eslint-disable @typescript-eslint/ban-types */
import { extend, isNil, isString, isObject, isNumber } from './common';
import { hashCode } from './strings';
import { isFunctionDefinition } from '@maptalks/function-type';

/**
 * Whether the color is a gradient
 * @param g - color to test
 * @return
 * @memberOf Util
 */
export function isGradient(g: Object): boolean {
    return g && g['colorStops'];
}

/**
 * Get stamp of a gradient color object.
 * @param g gradient color object
 * @return gradient stamp
 * @memberOf Util
 */
export function getGradientStamp(g: Object) {
    const keys = [g['type']];
    if (g['places']) {
        keys.push(g['places'].join());
    }
    if (g['colorStops']) {
        const stops = [];
        for (let i = g['colorStops'].length - 1; i >= 0; i--) {
            stops.push(g['colorStops'][i].join());
        }
        keys.push(stops.join(','));
    }
    return keys.join('_');
}

// back-compatibility alias
export function getSymbolStamp(symbol: Object, prefix: string) {
    return getSymbolHash(symbol, prefix);
}

/**
 * Get stamp of a symbol
 * @param symbol symbol
 * @return symbol's stamp
 * @memberOf Util
 */
export function getSymbolHash(symbol: Object | Object[], prefix: string) {
    if (!symbol) {
        return 1;
    }
    const keys = [];
    if (Array.isArray(symbol)) {
        for (let i = 0; i < symbol.length; i++) {
            keys.push(getSymbolHash(symbol[i], prefix));
        }
        return keys.sort().join(',');
    }
    const sortedKeys = Object.keys(symbol).sort();
    const sortedSymbol = sortedKeys.reduce((accumulator, curValue) => {
        if (!prefix || curValue.indexOf(prefix) === 0) {
            accumulator[curValue] = symbol[curValue];
        }
        return accumulator;
    }, {});
    const hash = hashCode(JSON.stringify(sortedSymbol));
    return hash;
}

/**
 * Reduce opacity of the color by ratio
 * @param symbol symbols to set
 * @param ratio  ratio of opacity to reduce
 * @return new symbol or symbols
 * @memberOf Util
 */
export function lowerSymbolOpacity(symbol: Object | Object[], ratio: number): Object | Object[] {
    function s(_symbol, _ratio) {
        const op = _symbol['opacity'];
        if (isNil(op)) {
            _symbol['opacity'] = _ratio;
        } else {
            _symbol['opacity'] *= _ratio;
        }
    }
    let lower;
    if (Array.isArray(symbol)) {
        lower = [];
        for (let i = 0; i < symbol.length; i++) {
            const d = extend({}, symbol[i]);
            s(d, ratio);
            lower.push(d);
        }
    } else {
        lower = extend({}, symbol);
        s(lower, ratio);
    }
    return lower;
}

/**
 * Merges the properties of sources into the symbol. <br>
 * @param symbol symbol to extend
 * @param args - sources
 * @return merged symbol
 * @memberOf Util
 */
export function extendSymbol(symbol: Object | Object[], ...args: Object[]): Object | Object[] {
    let sources = Array.prototype.slice.call(args, 1);
    if (!sources || !sources.length) {
        sources = [{}];
    }
    if (Array.isArray(symbol)) {
        let s, dest;
        const result = [];
        for (let i = 0, l = symbol.length; i < l; i++) {
            s = symbol[i];
            dest = {};
            for (let ii = 0, ll = sources.length; ii < ll; ii++) {
                if (!Array.isArray(sources[ii])) {
                    extend(dest, s, sources[ii] ? sources[ii] : {});
                } else if (!isNil(sources[ii][i])) {
                    extend(dest, s, sources[ii][i]);
                } else {
                    extend(dest, s ? s : {});
                }
            }
            result.push(dest);
        }
        return result;
    } else {
        const args = [{}, symbol];
        // eslint-disable-next-line prefer-spread
        args.push.apply(args, sources);
        return extend.apply(this, args);
    }
}

export function parseStyleRootPath(style: any) {
    if (style.symbol) {
        style = [style];
    }
    if (Array.isArray(style)) {
        return style;
    }
    let root = style['$root'];
    let iconset = style['$iconset'];
    style = style.style;
    if (root || iconset) {
        if (root && root[root.length - 1] === '/') {
            root = root.substring(0, root.length - 1);
        }
        if (iconset && iconset[iconset.length - 1] === '/') {
            iconset = iconset.substring(0, iconset.length - 1);
        }
        const replacer = function replacer(match) {
            if (match === '{$root}') {
                return root;
            } else if (match === '{$iconset}') {
                return iconset;
            }
            return null;
        };
        convertStylePath(style, replacer);
    }
    return style;
}

export function convertStylePath(styles: any[], replacer: any) {
    for (let i = 0; i < styles.length; i++) {
        const { symbol } = styles[i];
        if (symbol) {
            parseSymbolPath(symbol, replacer);
        }
    }

}
const URL_PATTERN = /(\{\$root\}|\{\$iconset\})/g;
export function parseSymbolPath(symbol: any, replacer: string) {
    for (const p in symbol) {
        if (symbol.hasOwnProperty(p) && p !== 'textName') {
            if (isString(symbol[p]) && symbol[p].length > 2) {
                symbol[p] = symbol[p].replace(URL_PATTERN, replacer);
            } else if (isFunctionDefinition(symbol[p])) {
                symbol[p] = parseStops(symbol[p], replacer);
            } else if (isObject(symbol[p])) {
                parseSymbolPath(symbol[p], replacer);
            }
        }
    }
}

function parseStops(value: any, replacer: string) {
    const defaultValue = value['default'];
    if (isString(defaultValue)) {
        value['default'] = defaultValue.replace(URL_PATTERN, replacer);
    }
    const stops = value.stops;
    if (!stops) {
        return value;
    }
    for (let i = 0; i < stops.length; i++) {
        if (!Array.isArray(stops[i])) {
            continue;
        }
        if (isString(stops[i][1])) {
            stops[i][1] = stops[i][1].replace(URL_PATTERN, replacer);
        } else if (isFunctionDefinition(stops[i][1])) {
            stops[i][1] = parseStops(stops[i][1], replacer);
        }
    }
    return value;
}

/**
 * geometry symbol has lineDasharray
 * @memberOf Util
 */
export function isDashLine(symbolizers: any[] = []) {
    if (!Array.isArray(symbolizers)) {
        symbolizers = [symbolizers];
    }
    const len = symbolizers.length;
    for (let i = 0; i < len; i++) {
        const symbolizer = symbolizers[i];
        if (!symbolizer.style) {
            continue;
        }
        const { lineDasharray, lineWidth } = symbolizer.style;
        if (lineWidth && isNumber(lineWidth) && (lineWidth as number) > 0 && lineDasharray && Array.isArray(lineDasharray) && lineDasharray.length) {
            return true;
        }
    }
    return false;

}
