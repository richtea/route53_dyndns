'use strict';

/**
 * Safely accesses a nested property on an object. If a property is missing on the input object at any level,
 * the function will return undefined.
 *
 * @param {any} input The input object from which to access a property.
 * @param {Function} accessor The function to access the property on the input object.
 * @returns {any} The property value, or undefined.
 */
function idx(input, accessor) {
    try {
        return accessor(input);
    } catch (e) {
        return undefined;
    }
}

module.exports.idx = idx;
