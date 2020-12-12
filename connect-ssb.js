(function () {
            'use strict';

            const global = window;

            var global$1 = (typeof global !== "undefined" ? global :
                        typeof self !== "undefined" ? self :
                        typeof window !== "undefined" ? window : {});

            var lookup = [];
            var revLookup = [];
            var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
            var inited = false;
            function init () {
              inited = true;
              var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
              for (var i = 0, len = code.length; i < len; ++i) {
                lookup[i] = code[i];
                revLookup[code.charCodeAt(i)] = i;
              }

              revLookup['-'.charCodeAt(0)] = 62;
              revLookup['_'.charCodeAt(0)] = 63;
            }

            function toByteArray (b64) {
              if (!inited) {
                init();
              }
              var i, j, l, tmp, placeHolders, arr;
              var len = b64.length;

              if (len % 4 > 0) {
                throw new Error('Invalid string. Length must be a multiple of 4')
              }

              // the number of equal signs (place holders)
              // if there are two placeholders, than the two characters before it
              // represent one byte
              // if there is only one, then the three characters before it represent 2 bytes
              // this is just a cheap hack to not do indexOf twice
              placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;

              // base64 is 4/3 + up to two characters of the original data
              arr = new Arr(len * 3 / 4 - placeHolders);

              // if there are placeholders, only get up to the last complete 4 chars
              l = placeHolders > 0 ? len - 4 : len;

              var L = 0;

              for (i = 0, j = 0; i < l; i += 4, j += 3) {
                tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)];
                arr[L++] = (tmp >> 16) & 0xFF;
                arr[L++] = (tmp >> 8) & 0xFF;
                arr[L++] = tmp & 0xFF;
              }

              if (placeHolders === 2) {
                tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
                arr[L++] = tmp & 0xFF;
              } else if (placeHolders === 1) {
                tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2);
                arr[L++] = (tmp >> 8) & 0xFF;
                arr[L++] = tmp & 0xFF;
              }

              return arr
            }

            function tripletToBase64 (num) {
              return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
            }

            function encodeChunk (uint8, start, end) {
              var tmp;
              var output = [];
              for (var i = start; i < end; i += 3) {
                tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
                output.push(tripletToBase64(tmp));
              }
              return output.join('')
            }

            function fromByteArray (uint8) {
              if (!inited) {
                init();
              }
              var tmp;
              var len = uint8.length;
              var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
              var output = '';
              var parts = [];
              var maxChunkLength = 16383; // must be multiple of 3

              // go through the array every three bytes, we'll deal with trailing stuff later
              for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
                parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
              }

              // pad the end with zeros, but make sure to not forget the extra bytes
              if (extraBytes === 1) {
                tmp = uint8[len - 1];
                output += lookup[tmp >> 2];
                output += lookup[(tmp << 4) & 0x3F];
                output += '==';
              } else if (extraBytes === 2) {
                tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
                output += lookup[tmp >> 10];
                output += lookup[(tmp >> 4) & 0x3F];
                output += lookup[(tmp << 2) & 0x3F];
                output += '=';
              }

              parts.push(output);

              return parts.join('')
            }

            function read (buffer, offset, isLE, mLen, nBytes) {
              var e, m;
              var eLen = nBytes * 8 - mLen - 1;
              var eMax = (1 << eLen) - 1;
              var eBias = eMax >> 1;
              var nBits = -7;
              var i = isLE ? (nBytes - 1) : 0;
              var d = isLE ? -1 : 1;
              var s = buffer[offset + i];

              i += d;

              e = s & ((1 << (-nBits)) - 1);
              s >>= (-nBits);
              nBits += eLen;
              for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

              m = e & ((1 << (-nBits)) - 1);
              e >>= (-nBits);
              nBits += mLen;
              for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

              if (e === 0) {
                e = 1 - eBias;
              } else if (e === eMax) {
                return m ? NaN : ((s ? -1 : 1) * Infinity)
              } else {
                m = m + Math.pow(2, mLen);
                e = e - eBias;
              }
              return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
            }

            function write (buffer, value, offset, isLE, mLen, nBytes) {
              var e, m, c;
              var eLen = nBytes * 8 - mLen - 1;
              var eMax = (1 << eLen) - 1;
              var eBias = eMax >> 1;
              var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
              var i = isLE ? 0 : (nBytes - 1);
              var d = isLE ? 1 : -1;
              var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

              value = Math.abs(value);

              if (isNaN(value) || value === Infinity) {
                m = isNaN(value) ? 1 : 0;
                e = eMax;
              } else {
                e = Math.floor(Math.log(value) / Math.LN2);
                if (value * (c = Math.pow(2, -e)) < 1) {
                  e--;
                  c *= 2;
                }
                if (e + eBias >= 1) {
                  value += rt / c;
                } else {
                  value += rt * Math.pow(2, 1 - eBias);
                }
                if (value * c >= 2) {
                  e++;
                  c /= 2;
                }

                if (e + eBias >= eMax) {
                  m = 0;
                  e = eMax;
                } else if (e + eBias >= 1) {
                  m = (value * c - 1) * Math.pow(2, mLen);
                  e = e + eBias;
                } else {
                  m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
                  e = 0;
                }
              }

              for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

              e = (e << mLen) | m;
              eLen += mLen;
              for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

              buffer[offset + i - d] |= s * 128;
            }

            var toString = {}.toString;

            var isArray = Array.isArray || function (arr) {
              return toString.call(arr) == '[object Array]';
            };

            var INSPECT_MAX_BYTES = 50;

            /**
             * If `Buffer.TYPED_ARRAY_SUPPORT`:
             *   === true    Use Uint8Array implementation (fastest)
             *   === false   Use Object implementation (most compatible, even IE6)
             *
             * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
             * Opera 11.6+, iOS 4.2+.
             *
             * Due to various browser bugs, sometimes the Object implementation will be used even
             * when the browser supports typed arrays.
             *
             * Note:
             *
             *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
             *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
             *
             *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
             *
             *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
             *     incorrect length in some situations.

             * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
             * get the Object implementation, which is slower but behaves correctly.
             */
            Buffer.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== undefined
              ? global$1.TYPED_ARRAY_SUPPORT
              : true;

            function kMaxLength () {
              return Buffer.TYPED_ARRAY_SUPPORT
                ? 0x7fffffff
                : 0x3fffffff
            }

            function createBuffer (that, length) {
              if (kMaxLength() < length) {
                throw new RangeError('Invalid typed array length')
              }
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                // Return an augmented `Uint8Array` instance, for best performance
                that = new Uint8Array(length);
                that.__proto__ = Buffer.prototype;
              } else {
                // Fallback: Return an object instance of the Buffer class
                if (that === null) {
                  that = new Buffer(length);
                }
                that.length = length;
              }

              return that
            }

            /**
             * The Buffer constructor returns instances of `Uint8Array` that have their
             * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
             * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
             * and the `Uint8Array` methods. Square bracket notation works as expected -- it
             * returns a single octet.
             *
             * The `Uint8Array` prototype remains unmodified.
             */

            function Buffer (arg, encodingOrOffset, length) {
              if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
                return new Buffer(arg, encodingOrOffset, length)
              }

              // Common case.
              if (typeof arg === 'number') {
                if (typeof encodingOrOffset === 'string') {
                  throw new Error(
                    'If encoding is specified then the first argument must be a string'
                  )
                }
                return allocUnsafe(this, arg)
              }
              return from(this, arg, encodingOrOffset, length)
            }

            Buffer.poolSize = 8192; // not used by this implementation

            // TODO: Legacy, not needed anymore. Remove in next major version.
            Buffer._augment = function (arr) {
              arr.__proto__ = Buffer.prototype;
              return arr
            };

            function from (that, value, encodingOrOffset, length) {
              if (typeof value === 'number') {
                throw new TypeError('"value" argument must not be a number')
              }

              if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
                return fromArrayBuffer(that, value, encodingOrOffset, length)
              }

              if (typeof value === 'string') {
                return fromString(that, value, encodingOrOffset)
              }

              return fromObject(that, value)
            }

            /**
             * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
             * if value is a number.
             * Buffer.from(str[, encoding])
             * Buffer.from(array)
             * Buffer.from(buffer)
             * Buffer.from(arrayBuffer[, byteOffset[, length]])
             **/
            Buffer.from = function (value, encodingOrOffset, length) {
              return from(null, value, encodingOrOffset, length)
            };

            if (Buffer.TYPED_ARRAY_SUPPORT) {
              Buffer.prototype.__proto__ = Uint8Array.prototype;
              Buffer.__proto__ = Uint8Array;
            }

            function assertSize (size) {
              if (typeof size !== 'number') {
                throw new TypeError('"size" argument must be a number')
              } else if (size < 0) {
                throw new RangeError('"size" argument must not be negative')
              }
            }

            function alloc (that, size, fill, encoding) {
              assertSize(size);
              if (size <= 0) {
                return createBuffer(that, size)
              }
              if (fill !== undefined) {
                // Only pay attention to encoding if it's a string. This
                // prevents accidentally sending in a number that would
                // be interpretted as a start offset.
                return typeof encoding === 'string'
                  ? createBuffer(that, size).fill(fill, encoding)
                  : createBuffer(that, size).fill(fill)
              }
              return createBuffer(that, size)
            }

            /**
             * Creates a new filled Buffer instance.
             * alloc(size[, fill[, encoding]])
             **/
            Buffer.alloc = function (size, fill, encoding) {
              return alloc(null, size, fill, encoding)
            };

            function allocUnsafe (that, size) {
              assertSize(size);
              that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
              if (!Buffer.TYPED_ARRAY_SUPPORT) {
                for (var i = 0; i < size; ++i) {
                  that[i] = 0;
                }
              }
              return that
            }

            /**
             * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
             * */
            Buffer.allocUnsafe = function (size) {
              return allocUnsafe(null, size)
            };
            /**
             * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
             */
            Buffer.allocUnsafeSlow = function (size) {
              return allocUnsafe(null, size)
            };

            function fromString (that, string, encoding) {
              if (typeof encoding !== 'string' || encoding === '') {
                encoding = 'utf8';
              }

              if (!Buffer.isEncoding(encoding)) {
                throw new TypeError('"encoding" must be a valid string encoding')
              }

              var length = byteLength(string, encoding) | 0;
              that = createBuffer(that, length);

              var actual = that.write(string, encoding);

              if (actual !== length) {
                // Writing a hex string, for example, that contains invalid characters will
                // cause everything after the first invalid character to be ignored. (e.g.
                // 'abxxcd' will be treated as 'ab')
                that = that.slice(0, actual);
              }

              return that
            }

            function fromArrayLike (that, array) {
              var length = array.length < 0 ? 0 : checked(array.length) | 0;
              that = createBuffer(that, length);
              for (var i = 0; i < length; i += 1) {
                that[i] = array[i] & 255;
              }
              return that
            }

            function fromArrayBuffer (that, array, byteOffset, length) {
              array.byteLength; // this throws if `array` is not a valid ArrayBuffer

              if (byteOffset < 0 || array.byteLength < byteOffset) {
                throw new RangeError('\'offset\' is out of bounds')
              }

              if (array.byteLength < byteOffset + (length || 0)) {
                throw new RangeError('\'length\' is out of bounds')
              }

              if (byteOffset === undefined && length === undefined) {
                array = new Uint8Array(array);
              } else if (length === undefined) {
                array = new Uint8Array(array, byteOffset);
              } else {
                array = new Uint8Array(array, byteOffset, length);
              }

              if (Buffer.TYPED_ARRAY_SUPPORT) {
                // Return an augmented `Uint8Array` instance, for best performance
                that = array;
                that.__proto__ = Buffer.prototype;
              } else {
                // Fallback: Return an object instance of the Buffer class
                that = fromArrayLike(that, array);
              }
              return that
            }

            function fromObject (that, obj) {
              if (internalIsBuffer(obj)) {
                var len = checked(obj.length) | 0;
                that = createBuffer(that, len);

                if (that.length === 0) {
                  return that
                }

                obj.copy(that, 0, 0, len);
                return that
              }

              if (obj) {
                if ((typeof ArrayBuffer !== 'undefined' &&
                    obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
                  if (typeof obj.length !== 'number' || isnan(obj.length)) {
                    return createBuffer(that, 0)
                  }
                  return fromArrayLike(that, obj)
                }

                if (obj.type === 'Buffer' && isArray(obj.data)) {
                  return fromArrayLike(that, obj.data)
                }
              }

              throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
            }

            function checked (length) {
              // Note: cannot use `length < kMaxLength()` here because that fails when
              // length is NaN (which is otherwise coerced to zero.)
              if (length >= kMaxLength()) {
                throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                                     'size: 0x' + kMaxLength().toString(16) + ' bytes')
              }
              return length | 0
            }
            Buffer.isBuffer = isBuffer;
            function internalIsBuffer (b) {
              return !!(b != null && b._isBuffer)
            }

            Buffer.compare = function compare (a, b) {
              if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
                throw new TypeError('Arguments must be Buffers')
              }

              if (a === b) return 0

              var x = a.length;
              var y = b.length;

              for (var i = 0, len = Math.min(x, y); i < len; ++i) {
                if (a[i] !== b[i]) {
                  x = a[i];
                  y = b[i];
                  break
                }
              }

              if (x < y) return -1
              if (y < x) return 1
              return 0
            };

            Buffer.isEncoding = function isEncoding (encoding) {
              switch (String(encoding).toLowerCase()) {
                case 'hex':
                case 'utf8':
                case 'utf-8':
                case 'ascii':
                case 'latin1':
                case 'binary':
                case 'base64':
                case 'ucs2':
                case 'ucs-2':
                case 'utf16le':
                case 'utf-16le':
                  return true
                default:
                  return false
              }
            };

            Buffer.concat = function concat (list, length) {
              if (!isArray(list)) {
                throw new TypeError('"list" argument must be an Array of Buffers')
              }

              if (list.length === 0) {
                return Buffer.alloc(0)
              }

              var i;
              if (length === undefined) {
                length = 0;
                for (i = 0; i < list.length; ++i) {
                  length += list[i].length;
                }
              }

              var buffer = Buffer.allocUnsafe(length);
              var pos = 0;
              for (i = 0; i < list.length; ++i) {
                var buf = list[i];
                if (!internalIsBuffer(buf)) {
                  throw new TypeError('"list" argument must be an Array of Buffers')
                }
                buf.copy(buffer, pos);
                pos += buf.length;
              }
              return buffer
            };

            function byteLength (string, encoding) {
              if (internalIsBuffer(string)) {
                return string.length
              }
              if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
                  (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
                return string.byteLength
              }
              if (typeof string !== 'string') {
                string = '' + string;
              }

              var len = string.length;
              if (len === 0) return 0

              // Use a for loop to avoid recursion
              var loweredCase = false;
              for (;;) {
                switch (encoding) {
                  case 'ascii':
                  case 'latin1':
                  case 'binary':
                    return len
                  case 'utf8':
                  case 'utf-8':
                  case undefined:
                    return utf8ToBytes(string).length
                  case 'ucs2':
                  case 'ucs-2':
                  case 'utf16le':
                  case 'utf-16le':
                    return len * 2
                  case 'hex':
                    return len >>> 1
                  case 'base64':
                    return base64ToBytes(string).length
                  default:
                    if (loweredCase) return utf8ToBytes(string).length // assume utf8
                    encoding = ('' + encoding).toLowerCase();
                    loweredCase = true;
                }
              }
            }
            Buffer.byteLength = byteLength;

            function slowToString (encoding, start, end) {
              var loweredCase = false;

              // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
              // property of a typed array.

              // This behaves neither like String nor Uint8Array in that we set start/end
              // to their upper/lower bounds if the value passed is out of range.
              // undefined is handled specially as per ECMA-262 6th Edition,
              // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
              if (start === undefined || start < 0) {
                start = 0;
              }
              // Return early if start > this.length. Done here to prevent potential uint32
              // coercion fail below.
              if (start > this.length) {
                return ''
              }

              if (end === undefined || end > this.length) {
                end = this.length;
              }

              if (end <= 0) {
                return ''
              }

              // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
              end >>>= 0;
              start >>>= 0;

              if (end <= start) {
                return ''
              }

              if (!encoding) encoding = 'utf8';

              while (true) {
                switch (encoding) {
                  case 'hex':
                    return hexSlice(this, start, end)

                  case 'utf8':
                  case 'utf-8':
                    return utf8Slice(this, start, end)

                  case 'ascii':
                    return asciiSlice(this, start, end)

                  case 'latin1':
                  case 'binary':
                    return latin1Slice(this, start, end)

                  case 'base64':
                    return base64Slice(this, start, end)

                  case 'ucs2':
                  case 'ucs-2':
                  case 'utf16le':
                  case 'utf-16le':
                    return utf16leSlice(this, start, end)

                  default:
                    if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
                    encoding = (encoding + '').toLowerCase();
                    loweredCase = true;
                }
              }
            }

            // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
            // Buffer instances.
            Buffer.prototype._isBuffer = true;

            function swap (b, n, m) {
              var i = b[n];
              b[n] = b[m];
              b[m] = i;
            }

            Buffer.prototype.swap16 = function swap16 () {
              var len = this.length;
              if (len % 2 !== 0) {
                throw new RangeError('Buffer size must be a multiple of 16-bits')
              }
              for (var i = 0; i < len; i += 2) {
                swap(this, i, i + 1);
              }
              return this
            };

            Buffer.prototype.swap32 = function swap32 () {
              var len = this.length;
              if (len % 4 !== 0) {
                throw new RangeError('Buffer size must be a multiple of 32-bits')
              }
              for (var i = 0; i < len; i += 4) {
                swap(this, i, i + 3);
                swap(this, i + 1, i + 2);
              }
              return this
            };

            Buffer.prototype.swap64 = function swap64 () {
              var len = this.length;
              if (len % 8 !== 0) {
                throw new RangeError('Buffer size must be a multiple of 64-bits')
              }
              for (var i = 0; i < len; i += 8) {
                swap(this, i, i + 7);
                swap(this, i + 1, i + 6);
                swap(this, i + 2, i + 5);
                swap(this, i + 3, i + 4);
              }
              return this
            };

            Buffer.prototype.toString = function toString () {
              var length = this.length | 0;
              if (length === 0) return ''
              if (arguments.length === 0) return utf8Slice(this, 0, length)
              return slowToString.apply(this, arguments)
            };

            Buffer.prototype.equals = function equals (b) {
              if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
              if (this === b) return true
              return Buffer.compare(this, b) === 0
            };

            Buffer.prototype.inspect = function inspect () {
              var str = '';
              var max = INSPECT_MAX_BYTES;
              if (this.length > 0) {
                str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
                if (this.length > max) str += ' ... ';
              }
              return '<Buffer ' + str + '>'
            };

            Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
              if (!internalIsBuffer(target)) {
                throw new TypeError('Argument must be a Buffer')
              }

              if (start === undefined) {
                start = 0;
              }
              if (end === undefined) {
                end = target ? target.length : 0;
              }
              if (thisStart === undefined) {
                thisStart = 0;
              }
              if (thisEnd === undefined) {
                thisEnd = this.length;
              }

              if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
                throw new RangeError('out of range index')
              }

              if (thisStart >= thisEnd && start >= end) {
                return 0
              }
              if (thisStart >= thisEnd) {
                return -1
              }
              if (start >= end) {
                return 1
              }

              start >>>= 0;
              end >>>= 0;
              thisStart >>>= 0;
              thisEnd >>>= 0;

              if (this === target) return 0

              var x = thisEnd - thisStart;
              var y = end - start;
              var len = Math.min(x, y);

              var thisCopy = this.slice(thisStart, thisEnd);
              var targetCopy = target.slice(start, end);

              for (var i = 0; i < len; ++i) {
                if (thisCopy[i] !== targetCopy[i]) {
                  x = thisCopy[i];
                  y = targetCopy[i];
                  break
                }
              }

              if (x < y) return -1
              if (y < x) return 1
              return 0
            };

            // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
            // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
            //
            // Arguments:
            // - buffer - a Buffer to search
            // - val - a string, Buffer, or number
            // - byteOffset - an index into `buffer`; will be clamped to an int32
            // - encoding - an optional encoding, relevant is val is a string
            // - dir - true for indexOf, false for lastIndexOf
            function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
              // Empty buffer means no match
              if (buffer.length === 0) return -1

              // Normalize byteOffset
              if (typeof byteOffset === 'string') {
                encoding = byteOffset;
                byteOffset = 0;
              } else if (byteOffset > 0x7fffffff) {
                byteOffset = 0x7fffffff;
              } else if (byteOffset < -0x80000000) {
                byteOffset = -0x80000000;
              }
              byteOffset = +byteOffset;  // Coerce to Number.
              if (isNaN(byteOffset)) {
                // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
                byteOffset = dir ? 0 : (buffer.length - 1);
              }

              // Normalize byteOffset: negative offsets start from the end of the buffer
              if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
              if (byteOffset >= buffer.length) {
                if (dir) return -1
                else byteOffset = buffer.length - 1;
              } else if (byteOffset < 0) {
                if (dir) byteOffset = 0;
                else return -1
              }

              // Normalize val
              if (typeof val === 'string') {
                val = Buffer.from(val, encoding);
              }

              // Finally, search either indexOf (if dir is true) or lastIndexOf
              if (internalIsBuffer(val)) {
                // Special case: looking for empty string/buffer always fails
                if (val.length === 0) {
                  return -1
                }
                return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
              } else if (typeof val === 'number') {
                val = val & 0xFF; // Search for a byte value [0-255]
                if (Buffer.TYPED_ARRAY_SUPPORT &&
                    typeof Uint8Array.prototype.indexOf === 'function') {
                  if (dir) {
                    return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
                  } else {
                    return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
                  }
                }
                return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
              }

              throw new TypeError('val must be string, number or Buffer')
            }

            function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
              var indexSize = 1;
              var arrLength = arr.length;
              var valLength = val.length;

              if (encoding !== undefined) {
                encoding = String(encoding).toLowerCase();
                if (encoding === 'ucs2' || encoding === 'ucs-2' ||
                    encoding === 'utf16le' || encoding === 'utf-16le') {
                  if (arr.length < 2 || val.length < 2) {
                    return -1
                  }
                  indexSize = 2;
                  arrLength /= 2;
                  valLength /= 2;
                  byteOffset /= 2;
                }
              }

              function read (buf, i) {
                if (indexSize === 1) {
                  return buf[i]
                } else {
                  return buf.readUInt16BE(i * indexSize)
                }
              }

              var i;
              if (dir) {
                var foundIndex = -1;
                for (i = byteOffset; i < arrLength; i++) {
                  if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
                    if (foundIndex === -1) foundIndex = i;
                    if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
                  } else {
                    if (foundIndex !== -1) i -= i - foundIndex;
                    foundIndex = -1;
                  }
                }
              } else {
                if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
                for (i = byteOffset; i >= 0; i--) {
                  var found = true;
                  for (var j = 0; j < valLength; j++) {
                    if (read(arr, i + j) !== read(val, j)) {
                      found = false;
                      break
                    }
                  }
                  if (found) return i
                }
              }

              return -1
            }

            Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
              return this.indexOf(val, byteOffset, encoding) !== -1
            };

            Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
              return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
            };

            Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
              return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
            };

            function hexWrite (buf, string, offset, length) {
              offset = Number(offset) || 0;
              var remaining = buf.length - offset;
              if (!length) {
                length = remaining;
              } else {
                length = Number(length);
                if (length > remaining) {
                  length = remaining;
                }
              }

              // must be an even number of digits
              var strLen = string.length;
              if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

              if (length > strLen / 2) {
                length = strLen / 2;
              }
              for (var i = 0; i < length; ++i) {
                var parsed = parseInt(string.substr(i * 2, 2), 16);
                if (isNaN(parsed)) return i
                buf[offset + i] = parsed;
              }
              return i
            }

            function utf8Write (buf, string, offset, length) {
              return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
            }

            function asciiWrite (buf, string, offset, length) {
              return blitBuffer(asciiToBytes(string), buf, offset, length)
            }

            function latin1Write (buf, string, offset, length) {
              return asciiWrite(buf, string, offset, length)
            }

            function base64Write (buf, string, offset, length) {
              return blitBuffer(base64ToBytes(string), buf, offset, length)
            }

            function ucs2Write (buf, string, offset, length) {
              return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
            }

            Buffer.prototype.write = function write (string, offset, length, encoding) {
              // Buffer#write(string)
              if (offset === undefined) {
                encoding = 'utf8';
                length = this.length;
                offset = 0;
              // Buffer#write(string, encoding)
              } else if (length === undefined && typeof offset === 'string') {
                encoding = offset;
                length = this.length;
                offset = 0;
              // Buffer#write(string, offset[, length][, encoding])
              } else if (isFinite(offset)) {
                offset = offset | 0;
                if (isFinite(length)) {
                  length = length | 0;
                  if (encoding === undefined) encoding = 'utf8';
                } else {
                  encoding = length;
                  length = undefined;
                }
              // legacy write(string, encoding, offset, length) - remove in v0.13
              } else {
                throw new Error(
                  'Buffer.write(string, encoding, offset[, length]) is no longer supported'
                )
              }

              var remaining = this.length - offset;
              if (length === undefined || length > remaining) length = remaining;

              if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
                throw new RangeError('Attempt to write outside buffer bounds')
              }

              if (!encoding) encoding = 'utf8';

              var loweredCase = false;
              for (;;) {
                switch (encoding) {
                  case 'hex':
                    return hexWrite(this, string, offset, length)

                  case 'utf8':
                  case 'utf-8':
                    return utf8Write(this, string, offset, length)

                  case 'ascii':
                    return asciiWrite(this, string, offset, length)

                  case 'latin1':
                  case 'binary':
                    return latin1Write(this, string, offset, length)

                  case 'base64':
                    // Warning: maxLength not taken into account in base64Write
                    return base64Write(this, string, offset, length)

                  case 'ucs2':
                  case 'ucs-2':
                  case 'utf16le':
                  case 'utf-16le':
                    return ucs2Write(this, string, offset, length)

                  default:
                    if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
                    encoding = ('' + encoding).toLowerCase();
                    loweredCase = true;
                }
              }
            };

            Buffer.prototype.toJSON = function toJSON () {
              return {
                type: 'Buffer',
                data: Array.prototype.slice.call(this._arr || this, 0)
              }
            };

            function base64Slice (buf, start, end) {
              if (start === 0 && end === buf.length) {
                return fromByteArray(buf)
              } else {
                return fromByteArray(buf.slice(start, end))
              }
            }

            function utf8Slice (buf, start, end) {
              end = Math.min(buf.length, end);
              var res = [];

              var i = start;
              while (i < end) {
                var firstByte = buf[i];
                var codePoint = null;
                var bytesPerSequence = (firstByte > 0xEF) ? 4
                  : (firstByte > 0xDF) ? 3
                  : (firstByte > 0xBF) ? 2
                  : 1;

                if (i + bytesPerSequence <= end) {
                  var secondByte, thirdByte, fourthByte, tempCodePoint;

                  switch (bytesPerSequence) {
                    case 1:
                      if (firstByte < 0x80) {
                        codePoint = firstByte;
                      }
                      break
                    case 2:
                      secondByte = buf[i + 1];
                      if ((secondByte & 0xC0) === 0x80) {
                        tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
                        if (tempCodePoint > 0x7F) {
                          codePoint = tempCodePoint;
                        }
                      }
                      break
                    case 3:
                      secondByte = buf[i + 1];
                      thirdByte = buf[i + 2];
                      if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
                        tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
                        if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                          codePoint = tempCodePoint;
                        }
                      }
                      break
                    case 4:
                      secondByte = buf[i + 1];
                      thirdByte = buf[i + 2];
                      fourthByte = buf[i + 3];
                      if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
                        tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
                        if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                          codePoint = tempCodePoint;
                        }
                      }
                  }
                }

                if (codePoint === null) {
                  // we did not generate a valid codePoint so insert a
                  // replacement char (U+FFFD) and advance only 1 byte
                  codePoint = 0xFFFD;
                  bytesPerSequence = 1;
                } else if (codePoint > 0xFFFF) {
                  // encode to utf16 (surrogate pair dance)
                  codePoint -= 0x10000;
                  res.push(codePoint >>> 10 & 0x3FF | 0xD800);
                  codePoint = 0xDC00 | codePoint & 0x3FF;
                }

                res.push(codePoint);
                i += bytesPerSequence;
              }

              return decodeCodePointsArray(res)
            }

            // Based on http://stackoverflow.com/a/22747272/680742, the browser with
            // the lowest limit is Chrome, with 0x10000 args.
            // We go 1 magnitude less, for safety
            var MAX_ARGUMENTS_LENGTH = 0x1000;

            function decodeCodePointsArray (codePoints) {
              var len = codePoints.length;
              if (len <= MAX_ARGUMENTS_LENGTH) {
                return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
              }

              // Decode in chunks to avoid "call stack size exceeded".
              var res = '';
              var i = 0;
              while (i < len) {
                res += String.fromCharCode.apply(
                  String,
                  codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
                );
              }
              return res
            }

            function asciiSlice (buf, start, end) {
              var ret = '';
              end = Math.min(buf.length, end);

              for (var i = start; i < end; ++i) {
                ret += String.fromCharCode(buf[i] & 0x7F);
              }
              return ret
            }

            function latin1Slice (buf, start, end) {
              var ret = '';
              end = Math.min(buf.length, end);

              for (var i = start; i < end; ++i) {
                ret += String.fromCharCode(buf[i]);
              }
              return ret
            }

            function hexSlice (buf, start, end) {
              var len = buf.length;

              if (!start || start < 0) start = 0;
              if (!end || end < 0 || end > len) end = len;

              var out = '';
              for (var i = start; i < end; ++i) {
                out += toHex(buf[i]);
              }
              return out
            }

            function utf16leSlice (buf, start, end) {
              var bytes = buf.slice(start, end);
              var res = '';
              for (var i = 0; i < bytes.length; i += 2) {
                res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
              }
              return res
            }

            Buffer.prototype.slice = function slice (start, end) {
              var len = this.length;
              start = ~~start;
              end = end === undefined ? len : ~~end;

              if (start < 0) {
                start += len;
                if (start < 0) start = 0;
              } else if (start > len) {
                start = len;
              }

              if (end < 0) {
                end += len;
                if (end < 0) end = 0;
              } else if (end > len) {
                end = len;
              }

              if (end < start) end = start;

              var newBuf;
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                newBuf = this.subarray(start, end);
                newBuf.__proto__ = Buffer.prototype;
              } else {
                var sliceLen = end - start;
                newBuf = new Buffer(sliceLen, undefined);
                for (var i = 0; i < sliceLen; ++i) {
                  newBuf[i] = this[i + start];
                }
              }

              return newBuf
            };

            /*
             * Need to make sure that buffer isn't trying to write out of bounds.
             */
            function checkOffset (offset, ext, length) {
              if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
              if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
            }

            Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) checkOffset(offset, byteLength, this.length);

              var val = this[offset];
              var mul = 1;
              var i = 0;
              while (++i < byteLength && (mul *= 0x100)) {
                val += this[offset + i] * mul;
              }

              return val
            };

            Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) {
                checkOffset(offset, byteLength, this.length);
              }

              var val = this[offset + --byteLength];
              var mul = 1;
              while (byteLength > 0 && (mul *= 0x100)) {
                val += this[offset + --byteLength] * mul;
              }

              return val
            };

            Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 1, this.length);
              return this[offset]
            };

            Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 2, this.length);
              return this[offset] | (this[offset + 1] << 8)
            };

            Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 2, this.length);
              return (this[offset] << 8) | this[offset + 1]
            };

            Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);

              return ((this[offset]) |
                  (this[offset + 1] << 8) |
                  (this[offset + 2] << 16)) +
                  (this[offset + 3] * 0x1000000)
            };

            Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);

              return (this[offset] * 0x1000000) +
                ((this[offset + 1] << 16) |
                (this[offset + 2] << 8) |
                this[offset + 3])
            };

            Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) checkOffset(offset, byteLength, this.length);

              var val = this[offset];
              var mul = 1;
              var i = 0;
              while (++i < byteLength && (mul *= 0x100)) {
                val += this[offset + i] * mul;
              }
              mul *= 0x80;

              if (val >= mul) val -= Math.pow(2, 8 * byteLength);

              return val
            };

            Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) checkOffset(offset, byteLength, this.length);

              var i = byteLength;
              var mul = 1;
              var val = this[offset + --i];
              while (i > 0 && (mul *= 0x100)) {
                val += this[offset + --i] * mul;
              }
              mul *= 0x80;

              if (val >= mul) val -= Math.pow(2, 8 * byteLength);

              return val
            };

            Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 1, this.length);
              if (!(this[offset] & 0x80)) return (this[offset])
              return ((0xff - this[offset] + 1) * -1)
            };

            Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 2, this.length);
              var val = this[offset] | (this[offset + 1] << 8);
              return (val & 0x8000) ? val | 0xFFFF0000 : val
            };

            Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 2, this.length);
              var val = this[offset + 1] | (this[offset] << 8);
              return (val & 0x8000) ? val | 0xFFFF0000 : val
            };

            Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);

              return (this[offset]) |
                (this[offset + 1] << 8) |
                (this[offset + 2] << 16) |
                (this[offset + 3] << 24)
            };

            Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);

              return (this[offset] << 24) |
                (this[offset + 1] << 16) |
                (this[offset + 2] << 8) |
                (this[offset + 3])
            };

            Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);
              return read(this, offset, true, 23, 4)
            };

            Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);
              return read(this, offset, false, 23, 4)
            };

            Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 8, this.length);
              return read(this, offset, true, 52, 8)
            };

            Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 8, this.length);
              return read(this, offset, false, 52, 8)
            };

            function checkInt (buf, value, offset, ext, max, min) {
              if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
              if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
              if (offset + ext > buf.length) throw new RangeError('Index out of range')
            }

            Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
              value = +value;
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) {
                var maxBytes = Math.pow(2, 8 * byteLength) - 1;
                checkInt(this, value, offset, byteLength, maxBytes, 0);
              }

              var mul = 1;
              var i = 0;
              this[offset] = value & 0xFF;
              while (++i < byteLength && (mul *= 0x100)) {
                this[offset + i] = (value / mul) & 0xFF;
              }

              return offset + byteLength
            };

            Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
              value = +value;
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) {
                var maxBytes = Math.pow(2, 8 * byteLength) - 1;
                checkInt(this, value, offset, byteLength, maxBytes, 0);
              }

              var i = byteLength - 1;
              var mul = 1;
              this[offset + i] = value & 0xFF;
              while (--i >= 0 && (mul *= 0x100)) {
                this[offset + i] = (value / mul) & 0xFF;
              }

              return offset + byteLength
            };

            Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
              if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
              this[offset] = (value & 0xff);
              return offset + 1
            };

            function objectWriteUInt16 (buf, value, offset, littleEndian) {
              if (value < 0) value = 0xffff + value + 1;
              for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
                buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
                  (littleEndian ? i : 1 - i) * 8;
              }
            }

            Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value & 0xff);
                this[offset + 1] = (value >>> 8);
              } else {
                objectWriteUInt16(this, value, offset, true);
              }
              return offset + 2
            };

            Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 8);
                this[offset + 1] = (value & 0xff);
              } else {
                objectWriteUInt16(this, value, offset, false);
              }
              return offset + 2
            };

            function objectWriteUInt32 (buf, value, offset, littleEndian) {
              if (value < 0) value = 0xffffffff + value + 1;
              for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
                buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff;
              }
            }

            Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset + 3] = (value >>> 24);
                this[offset + 2] = (value >>> 16);
                this[offset + 1] = (value >>> 8);
                this[offset] = (value & 0xff);
              } else {
                objectWriteUInt32(this, value, offset, true);
              }
              return offset + 4
            };

            Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 24);
                this[offset + 1] = (value >>> 16);
                this[offset + 2] = (value >>> 8);
                this[offset + 3] = (value & 0xff);
              } else {
                objectWriteUInt32(this, value, offset, false);
              }
              return offset + 4
            };

            Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) {
                var limit = Math.pow(2, 8 * byteLength - 1);

                checkInt(this, value, offset, byteLength, limit - 1, -limit);
              }

              var i = 0;
              var mul = 1;
              var sub = 0;
              this[offset] = value & 0xFF;
              while (++i < byteLength && (mul *= 0x100)) {
                if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
                  sub = 1;
                }
                this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
              }

              return offset + byteLength
            };

            Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) {
                var limit = Math.pow(2, 8 * byteLength - 1);

                checkInt(this, value, offset, byteLength, limit - 1, -limit);
              }

              var i = byteLength - 1;
              var mul = 1;
              var sub = 0;
              this[offset + i] = value & 0xFF;
              while (--i >= 0 && (mul *= 0x100)) {
                if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
                  sub = 1;
                }
                this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
              }

              return offset + byteLength
            };

            Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
              if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
              if (value < 0) value = 0xff + value + 1;
              this[offset] = (value & 0xff);
              return offset + 1
            };

            Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value & 0xff);
                this[offset + 1] = (value >>> 8);
              } else {
                objectWriteUInt16(this, value, offset, true);
              }
              return offset + 2
            };

            Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 8);
                this[offset + 1] = (value & 0xff);
              } else {
                objectWriteUInt16(this, value, offset, false);
              }
              return offset + 2
            };

            Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value & 0xff);
                this[offset + 1] = (value >>> 8);
                this[offset + 2] = (value >>> 16);
                this[offset + 3] = (value >>> 24);
              } else {
                objectWriteUInt32(this, value, offset, true);
              }
              return offset + 4
            };

            Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
              if (value < 0) value = 0xffffffff + value + 1;
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 24);
                this[offset + 1] = (value >>> 16);
                this[offset + 2] = (value >>> 8);
                this[offset + 3] = (value & 0xff);
              } else {
                objectWriteUInt32(this, value, offset, false);
              }
              return offset + 4
            };

            function checkIEEE754 (buf, value, offset, ext, max, min) {
              if (offset + ext > buf.length) throw new RangeError('Index out of range')
              if (offset < 0) throw new RangeError('Index out of range')
            }

            function writeFloat (buf, value, offset, littleEndian, noAssert) {
              if (!noAssert) {
                checkIEEE754(buf, value, offset, 4);
              }
              write(buf, value, offset, littleEndian, 23, 4);
              return offset + 4
            }

            Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
              return writeFloat(this, value, offset, true, noAssert)
            };

            Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
              return writeFloat(this, value, offset, false, noAssert)
            };

            function writeDouble (buf, value, offset, littleEndian, noAssert) {
              if (!noAssert) {
                checkIEEE754(buf, value, offset, 8);
              }
              write(buf, value, offset, littleEndian, 52, 8);
              return offset + 8
            }

            Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
              return writeDouble(this, value, offset, true, noAssert)
            };

            Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
              return writeDouble(this, value, offset, false, noAssert)
            };

            // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
            Buffer.prototype.copy = function copy (target, targetStart, start, end) {
              if (!start) start = 0;
              if (!end && end !== 0) end = this.length;
              if (targetStart >= target.length) targetStart = target.length;
              if (!targetStart) targetStart = 0;
              if (end > 0 && end < start) end = start;

              // Copy 0 bytes; we're done
              if (end === start) return 0
              if (target.length === 0 || this.length === 0) return 0

              // Fatal error conditions
              if (targetStart < 0) {
                throw new RangeError('targetStart out of bounds')
              }
              if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
              if (end < 0) throw new RangeError('sourceEnd out of bounds')

              // Are we oob?
              if (end > this.length) end = this.length;
              if (target.length - targetStart < end - start) {
                end = target.length - targetStart + start;
              }

              var len = end - start;
              var i;

              if (this === target && start < targetStart && targetStart < end) {
                // descending copy from end
                for (i = len - 1; i >= 0; --i) {
                  target[i + targetStart] = this[i + start];
                }
              } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
                // ascending copy from start
                for (i = 0; i < len; ++i) {
                  target[i + targetStart] = this[i + start];
                }
              } else {
                Uint8Array.prototype.set.call(
                  target,
                  this.subarray(start, start + len),
                  targetStart
                );
              }

              return len
            };

            // Usage:
            //    buffer.fill(number[, offset[, end]])
            //    buffer.fill(buffer[, offset[, end]])
            //    buffer.fill(string[, offset[, end]][, encoding])
            Buffer.prototype.fill = function fill (val, start, end, encoding) {
              // Handle string cases:
              if (typeof val === 'string') {
                if (typeof start === 'string') {
                  encoding = start;
                  start = 0;
                  end = this.length;
                } else if (typeof end === 'string') {
                  encoding = end;
                  end = this.length;
                }
                if (val.length === 1) {
                  var code = val.charCodeAt(0);
                  if (code < 256) {
                    val = code;
                  }
                }
                if (encoding !== undefined && typeof encoding !== 'string') {
                  throw new TypeError('encoding must be a string')
                }
                if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
                  throw new TypeError('Unknown encoding: ' + encoding)
                }
              } else if (typeof val === 'number') {
                val = val & 255;
              }

              // Invalid ranges are not set to a default, so can range check early.
              if (start < 0 || this.length < start || this.length < end) {
                throw new RangeError('Out of range index')
              }

              if (end <= start) {
                return this
              }

              start = start >>> 0;
              end = end === undefined ? this.length : end >>> 0;

              if (!val) val = 0;

              var i;
              if (typeof val === 'number') {
                for (i = start; i < end; ++i) {
                  this[i] = val;
                }
              } else {
                var bytes = internalIsBuffer(val)
                  ? val
                  : utf8ToBytes(new Buffer(val, encoding).toString());
                var len = bytes.length;
                for (i = 0; i < end - start; ++i) {
                  this[i + start] = bytes[i % len];
                }
              }

              return this
            };

            // HELPER FUNCTIONS
            // ================

            var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

            function base64clean (str) {
              // Node strips out invalid characters like \n and \t from the string, base64-js does not
              str = stringtrim(str).replace(INVALID_BASE64_RE, '');
              // Node converts strings with length < 2 to ''
              if (str.length < 2) return ''
              // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
              while (str.length % 4 !== 0) {
                str = str + '=';
              }
              return str
            }

            function stringtrim (str) {
              if (str.trim) return str.trim()
              return str.replace(/^\s+|\s+$/g, '')
            }

            function toHex (n) {
              if (n < 16) return '0' + n.toString(16)
              return n.toString(16)
            }

            function utf8ToBytes (string, units) {
              units = units || Infinity;
              var codePoint;
              var length = string.length;
              var leadSurrogate = null;
              var bytes = [];

              for (var i = 0; i < length; ++i) {
                codePoint = string.charCodeAt(i);

                // is surrogate component
                if (codePoint > 0xD7FF && codePoint < 0xE000) {
                  // last char was a lead
                  if (!leadSurrogate) {
                    // no lead yet
                    if (codePoint > 0xDBFF) {
                      // unexpected trail
                      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
                      continue
                    } else if (i + 1 === length) {
                      // unpaired lead
                      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
                      continue
                    }

                    // valid lead
                    leadSurrogate = codePoint;

                    continue
                  }

                  // 2 leads in a row
                  if (codePoint < 0xDC00) {
                    if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
                    leadSurrogate = codePoint;
                    continue
                  }

                  // valid surrogate pair
                  codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
                } else if (leadSurrogate) {
                  // valid bmp char, but last char was a lead
                  if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
                }

                leadSurrogate = null;

                // encode utf8
                if (codePoint < 0x80) {
                  if ((units -= 1) < 0) break
                  bytes.push(codePoint);
                } else if (codePoint < 0x800) {
                  if ((units -= 2) < 0) break
                  bytes.push(
                    codePoint >> 0x6 | 0xC0,
                    codePoint & 0x3F | 0x80
                  );
                } else if (codePoint < 0x10000) {
                  if ((units -= 3) < 0) break
                  bytes.push(
                    codePoint >> 0xC | 0xE0,
                    codePoint >> 0x6 & 0x3F | 0x80,
                    codePoint & 0x3F | 0x80
                  );
                } else if (codePoint < 0x110000) {
                  if ((units -= 4) < 0) break
                  bytes.push(
                    codePoint >> 0x12 | 0xF0,
                    codePoint >> 0xC & 0x3F | 0x80,
                    codePoint >> 0x6 & 0x3F | 0x80,
                    codePoint & 0x3F | 0x80
                  );
                } else {
                  throw new Error('Invalid code point')
                }
              }

              return bytes
            }

            function asciiToBytes (str) {
              var byteArray = [];
              for (var i = 0; i < str.length; ++i) {
                // Node's code seems to be doing this and not & 0x7F..
                byteArray.push(str.charCodeAt(i) & 0xFF);
              }
              return byteArray
            }

            function utf16leToBytes (str, units) {
              var c, hi, lo;
              var byteArray = [];
              for (var i = 0; i < str.length; ++i) {
                if ((units -= 2) < 0) break

                c = str.charCodeAt(i);
                hi = c >> 8;
                lo = c % 256;
                byteArray.push(lo);
                byteArray.push(hi);
              }

              return byteArray
            }


            function base64ToBytes (str) {
              return toByteArray(base64clean(str))
            }

            function blitBuffer (src, dst, offset, length) {
              for (var i = 0; i < length; ++i) {
                if ((i + offset >= dst.length) || (i >= src.length)) break
                dst[i + offset] = src[i];
              }
              return i
            }

            function isnan (val) {
              return val !== val // eslint-disable-line no-self-compare
            }


            // the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
            // The _isBuffer check is for Safari 5-7 support, because it's missing
            // Object.prototype.constructor. Remove this eventually
            function isBuffer(obj) {
              return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj))
            }

            function isFastBuffer (obj) {
              return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
            }

            // For Node v0.10 support. Remove this eventually.
            function isSlowBuffer (obj) {
              return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isFastBuffer(obj.slice(0, 0))
            }

            function getAugmentedNamespace(n) {
            	if (n.__esModule) return n;
            	var a = Object.defineProperty({}, '__esModule', {value: true});
            	Object.keys(n).forEach(function (k) {
            		var d = Object.getOwnPropertyDescriptor(n, k);
            		Object.defineProperty(a, k, d.get ? d : {
            			enumerable: true,
            			get: function () {
            				return n[k];
            			}
            		});
            	});
            	return a;
            }

            function createCommonjsModule(fn) {
              var module = { exports: {} };
            	return fn(module, module.exports), module.exports;
            }

            var looper_1 = createCommonjsModule(function (module) {
            var looper = module.exports = function (fun) {
              (function next () {
                var loop = true, sync = false;
                do {
                  sync = true; loop = false;
                  fun.call(this, function () {
                    if(sync) loop = true;
                    else     next();
                  });
                  sync = false;
                } while(loop)
              })();
            };
            });

            var pullThrough = function (writer, ender) {
              return function (read) {
                var queue = [], ended, error;

                function enqueue (data) {
                  queue.push(data);
                }

                writer = writer || function (data) {
                  this.queue(data);
                };

                ender = ender || function () {
                  this.queue(null);
                };

                var emitter = {
                  emit: function (event, data) {
                    if(event == 'data') enqueue(data);
                    if(event == 'end')  ended = true, enqueue(null);
                    if(event == 'error') error = data;
                  },
                  queue: enqueue
                };
                var _cb;
                return function (end, cb) {
                  ended = ended || end;
                  if(end)
                    return read(end, function () {
                      if(_cb) {
                        var t = _cb; _cb = null; t(end);
                      }
                      cb(end);
                    })

                  _cb = cb;
                  looper_1(function pull (next) {
                    //if it's an error
                    if(!_cb) return
                    cb = _cb;
                    if(error) _cb = null, cb(error);
                    else if(queue.length) {
                      var data = queue.shift();
                      _cb = null,cb(data === null, data);
                    }
                    else {
                      read(ended, function (end, data) {
                         //null has no special meaning for pull-stream
                        if(end && end !== true) {
                          error = end; return next()
                        }
                        if(ended = ended || end)  ender.call(emitter);
                        else if(data !== null) {
                          writer.call(emitter, data);
                          if(error || ended)
                            return read(error || ended, function () {
                              _cb = null; cb(error || ended);
                            })
                        }
                        next(pull);
                      });
                    }
                  });
                }
              }
            };

            var state = function () {

              var buffers = [], length = 0;

              return {
                length: length,
                data: this,
                add: function (data) {
                  if(!isBuffer(data))
                    throw new Error('data must be a buffer, was: ' + JSON.stringify(data))
                  this.length = length = length + data.length;
                  buffers.push(data);
                  return this
                },
                has: function (n) {
                  if(null == n) return length > 0
                  return length >= n
                },
                get: function (n) {
                  var _length;
                  if(n == null || n === length) {
                    length = 0;
                    var _buffers = buffers;
                    buffers = [];
                    if(_buffers.length == 1)
                      return _buffers[0]
                    else
                      return Buffer.concat(_buffers)
                  } else if (buffers.length > 1 && n <= (_length = buffers[0].length)) {
                    var buf = buffers[0].slice(0, n);
                    if(n === _length) {
                      buffers.shift();
                    }
                    else {
                      buffers[0] = buffers[0].slice(n, _length);
                    }
                    length -= n;
                    return buf
                  }  else if(n < length) {
                    var out = [], len = 0;

                    while((len + buffers[0].length) < n) {
                      var b = buffers.shift();
                      len += b.length;
                      out.push(b);
                    }

                    if(len < n) {
                      out.push(buffers[0].slice(0, n - len));
                      buffers[0] = buffers[0].slice(n - len, buffers[0].length);
                      this.length = length = length - n;
                    }
                    return Buffer.concat(out)
                  }
                  else
                    throw new Error('could not get ' + n + ' bytes')
                }
              }

            };

            function isInteger (i) {
              return Number.isFinite(i)
            }

            function isFunction (f) {
              return 'function' === typeof f
            }

            function maxDelay(fn, delay) {
              if(!delay) return fn
              return function (a, cb) {
                var timer = setTimeout(function () {
                  fn(new Error('pull-reader: read exceeded timeout'), cb);
                }, delay);
                fn(a, function (err, value) {
                  clearTimeout(timer);
                  cb(err, value);
                });

              }

            }

            var pullReader = function (timeout) {

              var queue = [], read, readTimed, reading = false;
              var state$1 = state(), ended, streaming, abort;

              function drain () {
                while (queue.length) {
                  if(null == queue[0].length && state$1.has(1)) {
                    queue.shift().cb(null, state$1.get());
                  }
                  else if(state$1.has(queue[0].length)) {
                    var next = queue.shift();
                    next.cb(null, state$1.get(next.length));
                  }
                  else if(ended == true && queue[0].length && state$1.length < queue[0].length) {
                    var msg = 'stream ended with:'+state$1.length+' but wanted:'+queue[0].length;
                    queue.shift().cb(new Error(msg));
                  }
                  else if(ended)
                    queue.shift().cb(ended);
                  else
                    return !!queue.length
                }
                //always read a little data
                return queue.length || !state$1.has(1) || abort
              }

              function more () {
                var d = drain();
                if(d && !reading)
                if(read && !reading && !streaming) {
                  reading = true;
                  readTimed (null, function (err, data) {
                    reading = false;
                    if(err) {
                      ended = err;
                      return drain()
                    }
                    state$1.add(data);
                    more();
                  });
                }
              }

              function reader (_read) {
                if(abort) {
                  while(queue.length) queue.shift().cb(abort);
                  return cb && cb(abort)
                }
                readTimed = maxDelay(_read, timeout);
                read = _read;
                more();
              }

              reader.abort = function (err, cb) {
                abort = err || true;
                if(read) {
                  reading = true;
                  read(abort, function () {
                    while(queue.length) queue.shift().cb(abort);
                    cb && cb(abort);
                  });
                }
                else
                  cb();
              };

              reader.read = function (len, _timeout, cb) {
                if(isFunction(_timeout))
                  cb = _timeout, _timeout = timeout;
                if(isFunction(cb)) {
                  queue.push({length: isInteger(len) ? len : null, cb: cb});
                  more();
                }
                else {
                  //switch into streaming mode for the rest of the stream.
                  streaming = true;
                  //wait for the current read to complete
                  return function (abort, cb) {
                    //if there is anything still in the queue,
                    if(reading || state$1.has(1)) {
                      if(abort) return read(abort, cb)
                      queue.push({length: null, cb: cb});
                      more();
                    }
                    else
                      maxDelay(read, _timeout)(abort, function (err, data) {
                        cb(err, data);
                      });
                  }
                }
              };

              return reader
            };

            var packetStreamCodec = createCommonjsModule(function (module, exports) {
            var BUFFER = 0, STRING = 1, OBJECT = 2;

            var GOODBYE = 'GOODBYE';
            var isBuffer$1 = isBuffer;

            function isString (s) {
              return 'string' === typeof s
            }

            function encodePair (msg) {

              var head = new Buffer(9);
              var flags = 0;
              var value = msg.value !== undefined ? msg.value : msg.end;

              //final packet
              if(isString(msg) && msg === GOODBYE) {
                head.fill(0);
                return [head, null]
              }

              if(isString(value)) {
                flags = STRING;
                value = new Buffer(value);
              }
              else if(isBuffer$1(value)) {
                flags = BUFFER;
              }
              else {
                flags = OBJECT;
                value = new Buffer(JSON.stringify(value));
              }

              // does this frame represent a msg, a req, or a stream?

              //end, stream

              flags = msg.stream << 3 | msg.end << 2 | flags;

              head[0] = flags;

              head.writeUInt32BE(value.length, 1);
              head.writeInt32BE(msg.req || 0, 5);

              return [head, value]
            }

            function decodeHead (bytes) {
              if(bytes.length != 9)
                throw new Error('expected header to be 9 bytes long')
              var flags = bytes[0];
              var length = bytes.readUInt32BE(1);
              var req = bytes.readInt32BE(5);

              return {
                req    : req,
                stream : !!(flags & 8),
                end    : !!(flags & 4),
                value  : null,
                length : length,
                type   : flags & 3
              }
            }

            function decodeBody (bytes, msg) {
              if(bytes.length !== msg.length)
                throw new Error('incorrect length, expected:'+msg.length+' found:'+bytes.length)
              if(BUFFER === msg.type) msg.value = bytes;
              else if(STRING === msg.type) msg.value = bytes.toString();
              else if(OBJECT === msg.type) msg.value = JSON.parse(bytes.toString());
              else throw new Error('unknown message type')
              return msg
            }

            function encode () {
              return pullThrough(function (d) {
                var c = encodePair(d);
                this.queue(c[0]);
                if(c[1] !== null)
                  this.queue(c[1]);
              })
            }

            function decode () {
              var reader = pullReader(), ended = false;

              return function (read) {
                reader(read);

                return function (abort, cb) {
                  if(ended) return cb(true)
                  if(abort) return reader.abort(abort, cb)
                  reader.read(9, function (err, head) {
                    if(err) return cb(err)
                    var msg = decodeHead(head);
                    if(msg.length === 0) { //final packet
                      ended = true;
                      return cb(null, GOODBYE)
                    }
                    reader.read(msg.length, function (err, body) {
                      if(err) return cb(err)
                      try {
                        decodeBody(body, msg);
                      } catch(e) {
                        return cb(e)
                      }
                      cb(null, msg);
                    });
                  });
                }
              }
            }

            exports = module.exports = function (stream) {
              return {
                source: encode()(stream.source),
                sink: function (read) { return stream.sink(decode()(read)) }
              }
            };

            exports.encodePair = encodePair;
            exports.decodeHead = decodeHead;
            exports.decodeBody = decodeBody;

            exports.encode = encode;
            exports.decode = decode;
            });

            function flat(err) {
              if(!err) return err
              if(err === true) return true
              return {message: err.message, name: err.name, stack: err.stack}
            }

            var packetStream = function (opts) {
              return new PacketStream(opts)
            };

            function PacketStream (opts) {
              this.ended = false;
              this.opts  = opts; // must release, may capture `this`

              this._req_counter = 1;
              this._requests    = {}; // must release, may capture `this`
              this._instreams   = {}; // must release, may capture `this`
              this._outstreams  = {}; // must release, may capture `this`
              this._closecbs    = []; // must release, may capture `this`
              this._closing     = false;
              this._closed      = false;
              if (opts.close)
                this._closecbs.push(opts.close);
            }

            // Sends a single message to the other end
            PacketStream.prototype.message = function (obj) {
              this.read({req: 0, stream: false, end: false, value: obj});
            };

            // Sends a message to the other end, expects an (err, obj) response
            PacketStream.prototype.request = function (obj, cb) {
              if (this._closing) return cb(new Error('parent stream is closing'))
              var rid = this._req_counter++;
              var self = this;
              this._requests[rid] = function (err, value) {
                delete self._requests[rid];
                cb(err, value);
                self._maybedone(err);
              };
              this.read({ req:rid, stream: false, end: false, value: obj });
            };

            // Sends a request to the other end for a stream
            PacketStream.prototype.stream = function () {
              if (this._closing) throw new Error('parent stream is closing')
              var rid = this._req_counter++;
              var self = this;
              this._outstreams[rid] = new PacketStreamSubstream(rid, this, function() { delete self._outstreams[rid]; });
              return this._outstreams[rid]
            };

            // Marks the packetstream to close when all current IO is finished
            PacketStream.prototype.close = function (cb) {
              if(!cb) throw new Error('packet-stream.close *must* have callback')
              if (this._closed)
                return cb()
              this._closecbs.push(cb);
              this._closing = true;
              this._maybedone();
            };

            // Forces immediate close of the PacketStream
            // - usually triggered by an `end` packet from the other end
            PacketStream.prototype.destroy = function (end) {
              end = end || flat(end);
              this.ended = end;
              this._closing = true;

              var err = (end === true)
                ? new Error('unexpected end of parent stream')
                : end;

              // force-close all requests and substreams
              var numended = 0;
              for (var k in this._requests)   { numended++; this._requests[k](err); }
              for (var k in this._instreams)  {
                numended++;
                // destroy substream without sending it a message
                this._instreams[k].writeEnd = true;
                this._instreams[k].destroy(err);
              }
              for (var k in this._outstreams) {
                numended++;
                // destroy substream without sending it a message
                this._outstreams[k].writeEnd = true;
                this._outstreams[k].destroy(err);
              }

              //from the perspective of the outside stream it's not an error
              //if the stream was in a state that where end was okay. (no open requests/streams)
              if (numended === 0 && end === true)
                err = null;
              this._maybedone(err);
            };

            PacketStream.prototype._maybedone = function (err) {
              if (this._closed || !this._closing)
                return

              // check if all requests and streams finished
              if (Object.keys(this._requests).length !== 0 ||
                  Object.keys(this._instreams).length !== 0 ||
                  Object.keys(this._outstreams).length !== 0)
                return // not yet

              // close
              this._closed = true;
              this._closecbs.forEach(function (cb) { cb(err); });
              this.read(null, err || true);

              // deallocate
              this.opts = null;
              this._closecbs.length = 0;
              this.read = closedread;
            };

            function closedread (msg) {
              console.error('packet-stream asked to read after closed', msg);
            }

            // Sends data out to the other end
            // - to be overridden by the PacketStream consumer
            PacketStream.prototype.read = function (msg) {
              console.error('please overwrite read method to do IO', msg);
            };

            // Accepts data from the other end
            PacketStream.prototype.write = function (msg, end) {
              if (this.ended)
                return

              if (end)                         this.destroy(end);
              else if (msg.req && !msg.stream) this._onrequest(msg);
              else if (msg.req && msg.stream)  this._onstream(msg);
              else                             this._onmessage(msg);
            };

            // Internal handler of incoming message msgs
            PacketStream.prototype._onmessage = function (msg) {
              if (this.opts && 'function' === typeof this.opts.message)
                this.opts.message(msg.value);
            };

            // Internal handler of incoming request msgs
            PacketStream.prototype._onrequest = function (msg) {
              var rid = msg.req*-1;
              if(msg.req < 0) {
                // A incoming response
                if (typeof this._requests[rid] == 'function')
                  this._requests[rid](
                    msg.end ? msg.value: null,
                    msg.end ? null : msg.value
                  );
              }
              else {
                // An incoming request
                if (this.opts && typeof this.opts.request == 'function') {
                  var once = false;
                  var self = this;
                  this.opts.request(msg.value, function (err, value) {
                    if(once) throw new Error('cb called twice from local api')
                    once = true;
                    if(err) self.read({ value: flat(err), end: true, req: rid });
                    else    self.read({ value: value, end: false, req: rid });
                    self._maybedone();
                  });
                } else {
                  if (this.ended) {
                    var err = (this.ended === true)
                      ? new Error('unexpected end of parent stream')
                      : this.ended;
                    this.read({ value: flat(err), end: true, stream: false, req: rid });
                  }
                  else
                    this.read({ value: {
                        message: 'Unable to handle requests',
                        name: 'NO_REQUEST_HANDLER', stack: null
                      },
                      end: true, stream: false, req: rid
                    });
                  this._maybedone();
                }
              }
            };

            // Internal handler of incoming stream msgs
            PacketStream.prototype._onstream = function (msg) {
              if(msg.req < 0) {
                // Incoming stream data
                var rid = msg.req*-1;
                var outs = this._outstreams[rid];
                if (!outs)
                  return console.error('no stream for incoming msg', msg)

                if (msg.end) {
                  if (outs.writeEnd)
                    delete this._outstreams[rid];
                  outs.readEnd = true;
                  outs.read(null, msg.value);
                  this._maybedone();
                }
                else
                  outs.read(msg.value);
              }
              else {
                // Incoming stream request
                var rid = msg.req;
                var ins = this._instreams[rid];

                if (!ins) {
                  // New stream
                  var self = this;
                  ins = this._instreams[rid] = new PacketStreamSubstream(rid*-1, this, function() { delete self._instreams[rid]; });
                  if (this.opts && typeof this.opts.stream == 'function')
                    this.opts.stream(ins);
                }

                if(msg.end) {
                  if (ins.writeEnd)
                    delete this._instreams[rid];
                  ins.readEnd = true;
                  if(ins.read)
                    ins.read(null, msg.value);
                  this._maybedone();
                }
                else if(ins.read)
                  ins.read(msg.value);
                else
                  console.error('no .read for stream:', ins.id, 'dropped:', msg);
              }
            };


            function PacketStreamSubstream (id, ps, remove) {
              this.id       = id;
              this.read     = null; // must release, may capture `this`
              this.writeEnd = null;
              this.readEnd  = null;

              this._ps          = ps;     // must release, may capture `this`
              this._remove      = remove; // must release, may capture `this`
              this._seq_counter = 1;
            }

            PacketStreamSubstream.prototype.write = function (data, err) {
              if (err) {
                this.writeEnd = err;
                var ps = this._ps;
                if (ps) {
                  ps.read({ req: this.id, stream: true, end: true, value: flat(err) });
                  if (this.readEnd)
                    this.destroy(err);
                  ps._maybedone(err);
                }
              }
              else {
                if (this._ps) this._ps.read({ req: this.id, stream: true, end: false, value: data });
              }
            };

            // Send the `end` message for the substream
            PacketStreamSubstream.prototype.end = function (err) {
              this.write(null, flat(err || true));
            };

            PacketStreamSubstream.prototype.destroy = function (err) {
              if (!this.writeEnd) {
                this.writeEnd = true;
                if (!this.readEnd) {
                  this.readEnd = true;
                  try {
                    // catch errors to ensure cleanup
                    this.read(null, err);
                  } catch (e) {
                    console.error('Exception thrown by PacketStream substream end handler', e);
                    console.error(e.stack);
                  }
                }
                this.write(null, err);
              }
              else if (!this.readEnd) {
                this.readEnd = true;
                try {
                  // catch errors to ensure cleanup
                  // don't assume that a stream has been piped anywhere.
                  if(this.read) this.read(null, err);
                } catch (e) {
                  console.error('Exception thrown by PacketStream substream end handler', e);
                  console.error(e.stack);
                }
              }

              // deallocate
              if (this._ps) {
                this._remove();
                this._remove = null;
                this.read = closedread;
                this._ps = null;
              }
            };

            var abortCb = function abortCb(cb, abort, onAbort) {
              cb(abort);
              onAbort && onAbort(abort === true ? null: abort);
              return
            };

            var values = function values (array, onAbort) {
              if(!array)
                return function (abort, cb) {
                  if(abort) return abortCb(cb, abort, onAbort)
                  return cb(true)
                }
              if(!Array.isArray(array))
                array = Object.keys(array).map(function (k) {
                  return array[k]
                });
              var i = 0;
              return function (abort, cb) {
                if(abort)
                  return abortCb(cb, abort, onAbort)
                if(i >= array.length)
                  cb(true);
                else
                  cb(null, array[i++]);
              }
            };

            var keys = function (object) {
              return values(Object.keys(object))
            };

            var once = function once (value, onAbort) {
              return function (abort, cb) {
                if(abort)
                  return abortCb(cb, abort, onAbort)
                if(value != null) {
                  var _value = value; value = null;
                  cb(null, _value);
                } else
                  cb(true);
              }
            };

            var count = function count (max) {
              var i = 0; max = max || Infinity;
              return function (end, cb) {
                if(end) return cb && cb(end)
                if(i > max)
                  return cb(true)
                cb(null, i++);
              }
            };

            var infinite = function infinite (generate) {
              generate = generate || Math.random;
              return function (end, cb) {
                if(end) return cb && cb(end)
                return cb(null, generate())
              }
            };

            //a stream that ends immediately.
            var empty = function empty () {
              return function (abort, cb) {
                cb(true);
              }
            };

            //a stream that errors immediately.
            var error = function error (err) {
              return function (abort, cb) {
                cb(err);
              }
            };

            var sources = {
              keys: keys,
              once: once,
              values: values,
              count: count,
              infinite: infinite,
              empty: empty,
              error: error
            };

            var drain = function drain (op, done) {
              var read, abort;

              function sink (_read) {
                read = _read;
                if(abort) return sink.abort()
                //this function is much simpler to write if you
                //just use recursion, but by using a while loop
                //we do not blow the stack if the stream happens to be sync.
                ;(function next() {
                    var loop = true, cbed = false;
                    while(loop) {
                      cbed = false;
                      read(null, function (end, data) {
                        cbed = true;
                        if(end = end || abort) {
                          loop = false;
                          if(done) done(end === true ? null : end);
                          else if(end && end !== true)
                            throw end
                        }
                        else if(op && false === op(data) || abort) {
                          loop = false;
                          read(abort || true, done || function () {});
                        }
                        else if(!loop){
                          next();
                        }
                      });
                      if(!cbed) {
                        loop = false;
                        return
                      }
                    }
                  })();
              }

              sink.abort = function (err, cb) {
                if('function' == typeof err)
                  cb = err, err = true;
                abort = err || true;
                if(read) return read(abort, cb || function () {})
              };

              return sink
            };

            var onEnd = function onEnd (done) {
              return drain(null, done)
            };

            var log = function log (done) {
              return drain(function (data) {
                console.log(data);
              }, done)
            };

            var prop = function prop (key) {
              return key && (
                'string' == typeof key
                ? function (data) { return data[key] }
                : 'object' === typeof key && 'function' === typeof key.exec //regexp
                ? function (data) { var v = key.exec(data); return v && v[0] }
                : key
              )
            };

            function id (e) { return e }



            var find = function find (test, cb) {
              var ended = false;
              if(!cb)
                cb = test, test = id;
              else
                test = prop(test) || id;

              return drain(function (data) {
                if(test(data)) {
                  ended = true;
                  cb(null, data);
                return false
                }
              }, function (err) {
                if(ended) return //already called back
                cb(err === true ? null : err, null);
              })
            };

            var reduce = function reduce (reducer, acc, cb ) {
              if(!cb) cb = acc, acc = null;
              var sink = drain(function (data) {
                acc = reducer(acc, data);
              }, function (err) {
                cb(err, acc);
              });
              if (arguments.length === 2)
                return function (source) {
                  source(null, function (end, data) {
                    //if ended immediately, and no initial...
                    if(end) return cb(end === true ? null : end)
                    acc = data; sink(source);
                  });
                }
              else
                return sink
            };

            var collect = function collect (cb) {
              return reduce(function (arr, item) {
                arr.push(item);
                return arr
              }, [], cb)
            };

            var concat = function concat (cb) {
              return reduce(function (a, b) {
                return a + b
              }, '', cb)
            };

            var sinks = {
              drain: drain,
              onEnd: onEnd,
              log: log,
              find: find,
              reduce: reduce,
              collect: collect,
              concat: concat
            };

            function id$1 (e) { return e }


            var map = function map (mapper) {
              if(!mapper) return id$1
              mapper = prop(mapper);
              return function (read) {
                return function (abort, cb) {
                  read(abort, function (end, data) {
                    try {
                    data = !end ? mapper(data) : null;
                    } catch (err) {
                      return read(err, function () {
                        return cb(err)
                      })
                    }
                    cb(end, data);
                  });
                }
              }
            };

            function id$2 (e) { return e }


            var asyncMap = function asyncMap (map) {
              if(!map) return id$2
              map = prop(map);
              var busy = false, abortCb, aborted;
              return function (read) {
                return function next (abort, cb) {
                  if(aborted) return cb(aborted)
                  if(abort) {
                    aborted = abort;
                    if(!busy) read(abort, function (err) {
                      //incase the source has already ended normally,
                      //we should pass our own error.
                      cb(abort);
                    });
                    else read(abort, function (err) {
                      //if we are still busy, wait for the mapper to complete.
                      if(busy) abortCb = cb;
                      else cb(abort);
                    });
                  }
                  else
                    read(null, function (end, data) {
                      if(end) cb(end);
                      else if(aborted) cb(aborted);
                      else {
                        busy = true;
                        map(data, function (err, data) {
                          busy = false;
                          if(aborted) {
                            cb(aborted);
                            abortCb && abortCb(aborted);
                          }
                          else if(err) next (err, cb);
                          else cb(null, data);
                        });
                      }
                    });
                }
              }
            };

            function id$3 (e) { return e }

            var tester = function tester (test) {
              return (
                'object' === typeof test && 'function' === typeof test.test //regexp
                ? function (data) { return test.test(data) }
                : prop (test) || id$3
              )
            };

            var filter = function filter (test) {
              //regexp
              test = tester(test);
              return function (read) {
                return function next (end, cb) {
                  var sync, loop = true;
                  while(loop) {
                    loop = false;
                    sync = true;
                    read(end, function (end, data) {
                      if(!end && !test(data))
                        return sync ? loop = true : next(end, cb)
                      cb(end, data);
                    });
                    sync = false;
                  }
                }
              }
            };

            var filterNot = function filterNot (test) {
              test = tester(test);
              return filter(function (data) { return !test(data) })
            };

            //a pass through stream that doesn't change the value.
            var through = function through (op, onEnd) {
              var a = false;

              function once (abort) {
                if(a || !onEnd) return
                a = true;
                onEnd(abort === true ? null : abort);
              }

              return function (read) {
                return function (end, cb) {
                  if(end) once(end);
                  return read(end, function (end, data) {
                    if(!end) op && op(data);
                    else once(end);
                    cb(end, data);
                  })
                }
              }
            };

            //read a number of items and then stop.
            var take = function take (test, opts) {
              opts = opts || {};
              var last = opts.last || false; // whether the first item for which !test(item) should still pass
              var ended = false;
              if('number' === typeof test) {
                last = true;
                var n = test; test = function () {
                  return --n
                };
              }

              return function (read) {

                function terminate (cb) {
                  read(true, function (err) {
                    last = false; cb(err || true);
                  });
                }

                return function (end, cb) {
                  if(ended && !end) last ? terminate(cb) : cb(ended);
                  else if(ended = end) read(ended, cb);
                  else
                    read(null, function (end, data) {
                      if(ended = ended || end) {
                        //last ? terminate(cb) :
                        cb(ended);
                      }
                      else if(!test(data)) {
                        ended = true;
                        last ? cb(null, data) : terminate(cb);
                      }
                      else
                        cb(null, data);
                    });
                }
              }
            };

            function id$4 (e) { return e }



            //drop items you have already seen.
            var unique = function unique (field, invert) {
              field = prop(field) || id$4;
              var seen = {};
              return filter(function (data) {
                var key = field(data);
                if(seen[key]) return !!invert //false, by default
                else seen[key] = true;
                return !invert //true by default
              })
            };

            //passes an item through when you see it for the second time.
            var nonUnique = function nonUnique (field) {
              return unique(field, true)
            };

            //convert a stream of arrays or streams into just a stream.
            var flatten = function flatten () {
              return function (read) {
                var _read;
                return function (abort, cb) {
                  if (abort) { //abort the current stream, and then stream of streams.
                    _read ? _read(abort, function(err) {
                      read(err || abort, cb);
                    }) : read(abort, cb);
                  }
                  else if(_read) nextChunk();
                  else nextStream();

                  function nextChunk () {
                    _read(null, function (err, data) {
                      if (err === true) nextStream();
                      else if (err) {
                        read(true, function(abortErr) {
                          // TODO: what do we do with the abortErr?
                          cb(err);
                        });
                      }
                      else cb(null, data);
                    });
                  }
                  function nextStream () {
                    _read = null;
                    read(null, function (end, stream) {
                      if(end)
                        return cb(end)
                      if(Array.isArray(stream) || stream && 'object' === typeof stream)
                        stream = values(stream);
                      else if('function' != typeof stream)
                        stream = once(stream);
                      _read = stream;
                      nextChunk();
                    });
                  }
                }
              }
            };

            var throughs = {
              map: map,
              asyncMap: asyncMap,
              filter: filter,
              filterNot: filterNot,
              through: through,
              take: take,
              unique: unique,
              nonUnique: nonUnique,
              flatten: flatten
            };

            var pull = function pull (a) {
              var length = arguments.length;
              if (typeof a === 'function' && a.length === 1) {
                var args = new Array(length);
                for(var i = 0; i < length; i++)
                  args[i] = arguments[i];
                return function (read) {
                  if (args == null) {
                    throw new TypeError("partial sink should only be called once!")
                  }

                  // Grab the reference after the check, because it's always an array now
                  // (engines like that kind of consistency).
                  var ref = args;
                  args = null;

                  // Prioritize common case of small number of pulls.
                  switch (length) {
                  case 1: return pull(read, ref[0])
                  case 2: return pull(read, ref[0], ref[1])
                  case 3: return pull(read, ref[0], ref[1], ref[2])
                  case 4: return pull(read, ref[0], ref[1], ref[2], ref[3])
                  default:
                    ref.unshift(read);
                    return pull.apply(null, ref)
                  }
                }
              }

              var read = a;

              if (read && typeof read.source === 'function') {
                read = read.source;
              }

              for (var i = 1; i < length; i++) {
                var s = arguments[i];
                if (typeof s === 'function') {
                  read = s(read);
                } else if (s && typeof s === 'object') {
                  s.sink(read);
                  read = s.source;
                }
              }

              return read
            };

            var pullStream = createCommonjsModule(function (module, exports) {





            exports = module.exports = pull;

            exports.pull = exports;

            for(var k in sources)
              exports[k] = sources[k];

            for(var k in throughs)
              exports[k] = throughs[k];

            for(var k in sinks)
              exports[k] = sinks[k];
            });

            var pullWeird = createCommonjsModule(function (module) {

            // wrap pull streams around packet-stream's weird streams.

            function once (fn) {
              var done = false;
              return function (err, val) {
                if(done) return
                done = true;
                fn(err, val);
              }
            }

            module.exports = function (weird, _done) {
              var buffer = [], ended = false, waiting, abort;

              var done = once(function (err, v) {
                _done && _done(err, v);
                // deallocate
                weird = null;
                _done = null;    
                waiting = null;

                if(abort) abort(err || true, function () {});
              });

              weird.read = function (data, end) {
                ended = ended || end;

                if(waiting) {
                  var cb = waiting;
                  waiting = null;
                  cb(ended, data);
                }
                else if(!ended) buffer.push(data);

                if(ended) done(ended !== true ? ended : null);
              };

              return {
                source: function (abort, cb) {
                  if(abort) {
                    weird && weird.write(null, abort);
                    cb(abort); done(abort !== true ? abort : null);
                  }
                  else if(buffer.length) cb(null, buffer.shift());
                  else if(ended) cb(ended);
                  else waiting = cb;
                },
                sink  : function (read) {
                  if(ended) return read(ended, function () {}), abort = null
                  abort = read;
                  pullStream.drain(function (data) {
                    //TODO: make this should only happen on a UNIPLEX stream.
                    if(ended) return false
                    weird.write(data);
                  }, function (err) {
                    if(weird && !weird.writeEnd) weird.write(null, err || true);
                    done && done(err);
                  })(read);
                }
              }
            };

            function uniplex (s, done) {
              return module.exports(s, function (err) {
                if(!s.writeEnd) s.write(null, err || true);
                if(done) done(err);
              })
            }

            module.exports.source = function (s) {
              return uniplex(s).source
            };
            module.exports.sink = function (s, done) {
              return uniplex(s, done).sink
            };

            module.exports.duplex = module.exports;
            });

            var endable = function endable (goodbye) {
              var ended, waiting, sentEnd;
              function h (read) {
                return function (abort, cb) {
                  read(abort, function (end, data) {
                    if(end && !sentEnd) {
                      sentEnd = true;
                      return cb(null, goodbye)
                    }
                    //send end message...

                    if(end && ended) cb(end);
                    else if(end)     waiting = cb;
                    else             cb(null, data);
                  });
                }
              }
              h.end = function () {
                ended = true;
                if(waiting) waiting(ended);
                return h
              };
              return h
            };

            var abortCb$1 = function abortCb(cb, abort, onAbort) {
              cb(abort);
              onAbort && onAbort(abort === true ? null: abort);
              return
            };

            var values$1 = function values (array, onAbort) {
              if(!array)
                return function (abort, cb) {
                  if(abort) return abortCb$1(cb, abort, onAbort)
                  return cb(true)
                }
              if(!Array.isArray(array))
                array = Object.keys(array).map(function (k) {
                  return array[k]
                });
              var i = 0;
              return function (abort, cb) {
                if(abort)
                  return abortCb$1(cb, abort, onAbort)
                if(i >= array.length)
                  cb(true);
                else
                  cb(null, array[i++]);
              }
            };

            var keys$1 = function (object) {
              return values$1(Object.keys(object))
            };

            var once$1 = function once (value, onAbort) {
              return function (abort, cb) {
                if(abort)
                  return abortCb$1(cb, abort, onAbort)
                if(value != null) {
                  var _value = value; value = null;
                  cb(null, _value);
                } else
                  cb(true);
              }
            };

            var count$1 = function count (max) {
              var i = 0; max = max || Infinity;
              return function (end, cb) {
                if(end) return cb && cb(end)
                if(i > max)
                  return cb(true)
                cb(null, i++);
              }
            };

            var infinite$1 = function infinite (generate) {
              generate = generate || Math.random;
              return function (end, cb) {
                if(end) return cb && cb(end)
                return cb(null, generate())
              }
            };

            //a stream that ends immediately.
            var empty$1 = function empty () {
              return function (abort, cb) {
                cb(true);
              }
            };

            //a stream that errors immediately.
            var error$1 = function error (err) {
              return function (abort, cb) {
                cb(err);
              }
            };

            var sources$1 = {
              keys: keys$1,
              once: once$1,
              values: values$1,
              count: count$1,
              infinite: infinite$1,
              empty: empty$1,
              error: error$1
            };

            var drain$1 = function drain (op, done) {
              var read, abort;

              function sink (_read) {
                read = _read;
                if(abort) return sink.abort()
                //this function is much simpler to write if you
                //just use recursion, but by using a while loop
                //we do not blow the stack if the stream happens to be sync.
                ;(function next() {
                    var loop = true, cbed = false;
                    while(loop) {
                      cbed = false;
                      read(null, function (end, data) {
                        cbed = true;
                        if(end = end || abort) {
                          loop = false;
                          if(done) done(end === true ? null : end);
                          else if(end && end !== true)
                            throw end
                        }
                        else if(op && false === op(data) || abort) {
                          loop = false;
                          read(abort || true, done || function () {});
                        }
                        else if(!loop){
                          next();
                        }
                      });
                      if(!cbed) {
                        loop = false;
                        return
                      }
                    }
                  })();
              }

              sink.abort = function (err, cb) {
                if('function' == typeof err)
                  cb = err, err = true;
                abort = err || true;
                if(read) return read(abort, cb || function () {})
              };

              return sink
            };

            var onEnd$1 = function onEnd (done) {
              return drain$1(null, done)
            };

            var log$1 = function log (done) {
              return drain$1(function (data) {
                console.log(data);
              }, done)
            };

            var prop$1 = function prop (key) {
              return key && (
                'string' == typeof key
                ? function (data) { return data[key] }
                : 'object' === typeof key && 'function' === typeof key.exec //regexp
                ? function (data) { var v = key.exec(data); return v && v[0] }
                : key
              )
            };

            function id$5 (e) { return e }



            var find$1 = function find (test, cb) {
              var ended = false;
              if(!cb)
                cb = test, test = id$5;
              else
                test = prop$1(test) || id$5;

              return drain$1(function (data) {
                if(test(data)) {
                  ended = true;
                  cb(null, data);
                return false
                }
              }, function (err) {
                if(ended) return //already called back
                cb(err === true ? null : err, null);
              })
            };

            var reduce$1 = function reduce (reducer, acc, cb ) {
              if(!cb) cb = acc, acc = null;
              var sink = drain$1(function (data) {
                acc = reducer(acc, data);
              }, function (err) {
                cb(err, acc);
              });
              if (arguments.length === 2)
                return function (source) {
                  source(null, function (end, data) {
                    //if ended immediately, and no initial...
                    if(end) return cb(end === true ? null : end)
                    acc = data; sink(source);
                  });
                }
              else
                return sink
            };

            var collect$1 = function collect (cb) {
              return reduce$1(function (arr, item) {
                arr.push(item);
                return arr
              }, [], cb)
            };

            var concat$1 = function concat (cb) {
              return reduce$1(function (a, b) {
                return a + b
              }, '', cb)
            };

            var sinks$1 = {
              drain: drain$1,
              onEnd: onEnd$1,
              log: log$1,
              find: find$1,
              reduce: reduce$1,
              collect: collect$1,
              concat: concat$1
            };

            function id$6 (e) { return e }


            var map$1 = function map (mapper) {
              if(!mapper) return id$6
              mapper = prop$1(mapper);
              return function (read) {
                return function (abort, cb) {
                  read(abort, function (end, data) {
                    try {
                    data = !end ? mapper(data) : null;
                    } catch (err) {
                      return read(err, function () {
                        return cb(err)
                      })
                    }
                    cb(end, data);
                  });
                }
              }
            };

            function id$7 (e) { return e }


            var asyncMap$1 = function asyncMap (map) {
              if(!map) return id$7
              map = prop$1(map);
              var busy = false, abortCb, aborted;
              return function (read) {
                return function next (abort, cb) {
                  if(aborted) return cb(aborted)
                  if(abort) {
                    aborted = abort;
                    if(!busy) read(abort, cb);
                    else read(abort, function () {
                      //if we are still busy, wait for the mapper to complete.
                      if(busy) abortCb = cb;
                      else cb(abort);
                    });
                  }
                  else
                    read(null, function (end, data) {
                      if(end) cb(end);
                      else if(aborted) cb(aborted);
                      else {
                        busy = true;
                        map(data, function (err, data) {
                          busy = false;
                          if(aborted) {
                            cb(aborted);
                            abortCb(aborted);
                          }
                          else if(err) next (err, cb);
                          else cb(null, data);
                        });
                      }
                    });
                }
              }
            };

            function id$8 (e) { return e }

            var tester$1 = function tester (test) {
              return (
                'object' === typeof test && 'function' === typeof test.test //regexp
                ? function (data) { return test.test(data) }
                : prop$1 (test) || id$8
              )
            };

            var filter$1 = function filter (test) {
              //regexp
              test = tester$1(test);
              return function (read) {
                return function next (end, cb) {
                  var sync, loop = true;
                  while(loop) {
                    loop = false;
                    sync = true;
                    read(end, function (end, data) {
                      if(!end && !test(data))
                        return sync ? loop = true : next(end, cb)
                      cb(end, data);
                    });
                    sync = false;
                  }
                }
              }
            };

            var filterNot$1 = function filterNot (test) {
              test = tester$1(test);
              return filter$1(function (data) { return !test(data) })
            };

            //a pass through stream that doesn't change the value.
            var through$1 = function through (op, onEnd) {
              var a = false;

              function once (abort) {
                if(a || !onEnd) return
                a = true;
                onEnd(abort === true ? null : abort);
              }

              return function (read) {
                return function (end, cb) {
                  if(end) once(end);
                  return read(end, function (end, data) {
                    if(!end) op && op(data);
                    else once(end);
                    cb(end, data);
                  })
                }
              }
            };

            //read a number of items and then stop.
            var take$1 = function take (test, opts) {
              opts = opts || {};
              var last = opts.last || false; // whether the first item for which !test(item) should still pass
              var ended = false;
              if('number' === typeof test) {
                last = true;
                var n = test; test = function () {
                  return --n
                };
              }

              return function (read) {

                function terminate (cb) {
                  read(true, function (err) {
                    last = false; cb(err || true);
                  });
                }

                return function (end, cb) {
                  if(ended)            last ? terminate(cb) : cb(ended);
                  else if(ended = end) read(ended, cb);
                  else
                    read(null, function (end, data) {
                      if(ended = ended || end) {
                        //last ? terminate(cb) :
                        cb(ended);
                      }
                      else if(!test(data)) {
                        ended = true;
                        last ? cb(null, data) : terminate(cb);
                      }
                      else
                        cb(null, data);
                    });
                }
              }
            };

            function id$9 (e) { return e }



            //drop items you have already seen.
            var unique$1 = function unique (field, invert) {
              field = prop$1(field) || id$9;
              var seen = {};
              return filter$1(function (data) {
                var key = field(data);
                if(seen[key]) return !!invert //false, by default
                else seen[key] = true;
                return !invert //true by default
              })
            };

            //passes an item through when you see it for the second time.
            var nonUnique$1 = function nonUnique (field) {
              return unique$1(field, true)
            };

            //convert a stream of arrays or streams into just a stream.
            var flatten$1 = function flatten () {
              return function (read) {
                var _read;
                return function (abort, cb) {
                  if (abort) { //abort the current stream, and then stream of streams.
                    _read ? _read(abort, function(err) {
                      read(err || abort, cb);
                    }) : read(abort, cb);
                  }
                  else if(_read) nextChunk();
                  else nextStream();

                  function nextChunk () {
                    _read(null, function (err, data) {
                      if (err === true) nextStream();
                      else if (err) {
                        read(true, function(abortErr) {
                          // TODO: what do we do with the abortErr?
                          cb(err);
                        });
                      }
                      else cb(null, data);
                    });
                  }
                  function nextStream () {
                    _read = null;
                    read(null, function (end, stream) {
                      if(end)
                        return cb(end)
                      if(Array.isArray(stream) || stream && 'object' === typeof stream)
                        stream = values$1(stream);
                      else if('function' != typeof stream)
                        stream = once$1(stream);
                      _read = stream;
                      nextChunk();
                    });
                  }
                }
              }
            };

            var throughs$1 = {
              map: map$1,
              asyncMap: asyncMap$1,
              filter: filter$1,
              filterNot: filterNot$1,
              through: through$1,
              take: take$1,
              unique: unique$1,
              nonUnique: nonUnique$1,
              flatten: flatten$1
            };

            var pull$1 = function pull (a) {
              var length = arguments.length;
              if (typeof a === 'function' && a.length === 1) {
                var args = new Array(length);
                for(var i = 0; i < length; i++)
                  args[i] = arguments[i];
                return function (read) {
                  if (args == null) {
                    throw new TypeError("partial sink should only be called once!")
                  }

                  // Grab the reference after the check, because it's always an array now
                  // (engines like that kind of consistency).
                  var ref = args;
                  args = null;

                  // Prioritize common case of small number of pulls.
                  switch (length) {
                  case 1: return pull(read, ref[0])
                  case 2: return pull(read, ref[0], ref[1])
                  case 3: return pull(read, ref[0], ref[1], ref[2])
                  case 4: return pull(read, ref[0], ref[1], ref[2], ref[3])
                  default:
                    ref.unshift(read);
                    return pull.apply(null, ref)
                  }
                }
              }

              var read = a;

              if (read && typeof read.source === 'function') {
                read = read.source;
              }

              for (var i = 1; i < length; i++) {
                var s = arguments[i];
                if (typeof s === 'function') {
                  read = s(read);
                } else if (s && typeof s === 'object') {
                  s.sink(read);
                  read = s.source;
                }
              }

              return read
            };

            var pullStream$1 = createCommonjsModule(function (module, exports) {





            exports = module.exports = pull$1;

            for(var k in sources$1)
              exports[k] = sources$1[k];

            for(var k in throughs$1)
              exports[k] = throughs$1[k];

            for(var k in sinks$1)
              exports[k] = sinks$1[k];
            });

            var pullGoodbye = function (stream, goodbye) {
              goodbye = goodbye || 'GOODBYE';
              var e = endable(goodbye);

              return {
                // when the source ends,
                // send the goodbye and then wait to recieve
                // the other goodbye.
                source: pullStream$1(stream.source, e),
                sink: pullStream$1(
                  //when the goodbye is received, allow the source to end.
                  pullStream$1.filter(function (data) {
                    if(data !== goodbye) return true
                    e.end();
                  }),
                  stream.sink
                )
              }

            };

            function isString (s) {
              return 'string' === typeof s
            }

            function isEmpty (obj) {
              for(var k in obj) return false;
              return true
            }

            //I wrote set as part of permissions.js
            //and then later mount, they do nearly the same thing
            //but not quite. this should be refactored sometime.
            //what differs is that set updates the last key in the path
            //to the new value, but mount merges the last value
            //which makes sense if it's an object, and set makes sense if it's
            //a string/number/boolean.

            var set = function (obj, path, value) {
              var _obj, _k;
              for(var i = 0; i < path.length; i++) {
                var k = path[i];
                obj[k] = obj[k] || {};
                _obj = obj; _k = k;
                obj = obj[k];
              }
              _obj[_k] = value;
            };

            var get = function (obj, path) {
              if(isString(path)) return obj[path]
              var value;
              for(var i = 0; i < path.length; i++) {
                var k = path[i];
                value = obj = obj[k];
                if(null == obj) return obj
              }
              return value
            };

            var prefix = function (obj, path) {
              var value;

              for(var i = 0; i < path.length; i++) {
                var k = path[i];
                value = obj = obj[k];
                if('object' !== typeof obj) {
                  return obj
                }
              }
              return 'object' !== typeof value ? !!value : false
            };

            function mkPath(obj, path) {
              for(var i in path) {
                var key = path[i];
                if(!obj[key]) obj[key]={};
                obj = obj[key];
              }

              return obj
            }

            function rmPath (obj, path) {
              (function r (obj, i) {
                var key = path[i];
                if(!obj) return
                else if(path.length - 1 === i)
                  delete obj[key];
                else if(i < path.length) r(obj[key], i+1);
                if(isEmpty(obj[key])) delete obj[key];
              })(obj, 0);
            }

            function merge (obj, _obj) {
              for(var k in _obj)
                obj[k] = _obj[k];
              return obj
            }

            var mount = function (obj, path, _obj) {
              if(!Array.isArray(path))
                throw new Error('path must be array of strings')
              return merge(mkPath(obj, path), _obj)
            };
            var unmount = function (obj, path) {
              return rmPath(obj, path)
            };

            function isSource    (t) { return 'source' === t }
            function isSink      (t) { return 'sink'   === t }
            function isDuplex    (t) { return 'duplex' === t }
            function isSync      (t) { return 'sync'  === t }
            function isAsync     (t) { return 'async'  === t }
            function isRequest   (t) { return isSync(t) || isAsync(t) }

            function abortSink (err) {
              return function (read) {
                read(err || true, function () {});
              }
            }

            function abortDuplex (err) {
              return {source: pullStream.error(err), sink: abortSink(err)}
            }

            var errorAsStream = function (type, err) {
              return (
                  isSource(type)  ? pullStream.error(err)
                : isSink(type)    ? abortSink(err)
                :                   abortDuplex(err)
              )
            };


            var errorAsStreamOrCb = function (type, err, cb) {
              return (
                  isRequest(type) ? cb(err)
                : isSource(type)  ? pullStream.error(err)
                : isSink(type)    ? abortSink(err)
                :                   cb(err), abortDuplex(err)
              )
            };

            var pipeToStream = function (type, _stream, stream) {
              if(isSource(type))
                _stream(stream);
              else if (isSink(type))
                stream(_stream);
              else if (isDuplex(type))
                pullStream(_stream, stream, _stream);
            };

            var util = {
            	set: set,
            	get: get,
            	prefix: prefix,
            	mount: mount,
            	unmount: unmount,
            	errorAsStream: errorAsStream,
            	errorAsStreamOrCb: errorAsStreamOrCb,
            	pipeToStream: pipeToStream
            };

            var explainError = createCommonjsModule(function (module) {
            function getStack(err) {
              if(err.stack && err.name && err.message)
                return err.stack.substring(err.name.length + 3 + err.message.length)
                  .split('\n')
              else if(err.stack)
                return err.stack.split('\n')
            }

            function removePrefix (a, b) {
              return a.filter(function (e) {
                return !~b.indexOf(e)
              })
            }

            var explain = module.exports = function (err, message) {
              if(!(err.stack && err.name && err.message)) {
                console.error(new Error('stackless error'));
                return err
              }

              var _err = new Error(message);
              var stack = removePrefix(getStack(_err).slice(1), getStack(err)).join('\n');

              _err.__proto__ = err;

              _err.stack =
                _err.name + ': ' + _err.message + '\n' +
                stack + '\n  ' + err.stack;

              return _err
            };
            });

            function isFunction$1 (f) {
              return 'function' === typeof f
            }

            function isSource$1    (t) { return 'source' === t }
            function isSink$1      (t) { return 'sink'   === t }
            function isDuplex$1    (t) { return 'duplex' === t }
            function isSync$1      (t) { return 'sync'  === t }
            function isAsync$1     (t) { return 'async'  === t }
            function isRequest$1   (t) { return isSync$1(t) || isAsync$1(t) }
            function isStream    (t) { return isSource$1(t) || isSink$1(t) || isDuplex$1(t) }

            var stream = function initStream (localCall, codec, onClose) {

              var ps = packetStream({
                message: function () {
            //      if(isString(msg)) return
            //      if(msg.length > 0 && isString(msg[0]))
            //        localCall('msg', 'emit', msg)
                },
                request: function (opts, cb) {
                  if(!Array.isArray(opts.args))
                    return cb(new Error('invalid request, args should be array, was:'+JSON.stringify(opts)))
                  var name = opts.name, args = opts.args;
                  var inCB = false, called = false;

                  args.push(function (err, value) {
                    called = true;
                    inCB = true; cb(err, value);
                  });
                  try {
                    localCall('async', name, args);
                  } catch (err) {
                    if(inCB || called) throw explainError(err, 'no callback provided to muxrpc async funtion')
                    return cb(err)
                  }

                },
                stream: function (stream) {
                  stream.read = function (data, end) {
                    //how would this actually happen?
                    if(end) return stream.write(null, end)

                    var name = data.name;
                    var type = data.type;
                    var err, value;

                    stream.read = null;

                    if(!isStream(type))
                      return stream.write(null, new Error('unsupported stream type:'+type))

                    try { value = localCall(type, name, data.args); }
                    catch (_err) { err = _err; }

                    var _stream = pullWeird[
                      {source: 'sink', sink: 'source'}[type] || 'duplex'
                    ](stream);

                    return util.pipeToStream(
                      type, _stream,
                      err ? util.errorAsStream(type, err) : value
                    )

            //        if(isSource(type))
            //          _stream(err ? pull.error(err) : value)
            //        else if (isSink(type))
            //          (err ? abortSink(err) : value)(_stream)
            //        else if (isDuplex(type))
            //          pull(_stream, err ? abortDuplex(err) : value, _stream)
                  };
                },

                close: function (err) {
                    ps = null; // deallocate
                    ws.ended = true;
                    if(ws.closed) return
                    ws.closed = true;
                    if(onClose) {
                      var close = onClose; onClose = null; close(err);
                    }
                  }
              });

              var ws = pullGoodbye(pullWeird(ps, function () {
                //this error will be handled in PacketStream.close
              }));

              ws = codec ? codec(ws) : ws;

              ws.remoteCall = function (type, name, args, cb) {
                if(name === 'emit') return ps.message(args)

                if(!(isRequest$1(type) || isStream(type)))
                  throw new Error('unsupported type:' + JSON.stringify(type))

                if(isRequest$1(type))
                  return ps.request({name: name, args: args}, cb)

                var ws = ps.stream(), s = pullWeird[type](ws, cb);
                ws.write({name: name, args: args, type: type});
                return s
              };


              //hack to work around ordering in setting ps.ended.
              //Question: if an object has subobjects, which
              //all have close events, should the subobjects fire close
              //before the parent? or should parents close after?
              //should there be a preclose event on the parent
              //that fires when it's about to close all the children?
              ws.isOpen = function () {
                return !ps.ended
              };

              ws.close = function (err, cb) {
                if(isFunction$1(err))
                  cb = err, err = false;
                if(!ps) return (cb && cb())
                if(err) return ps.destroy(err), (cb && cb())

                ps.close(function (err) {
                  if(cb) cb(err);
                  else if(err) throw explainError(err, 'no callback provided for muxrpc close')
                });

                return this
              };
              ws.closed = false;

              return ws
            };

            function isFunction$2 (f) {
              return 'function' === typeof f
            }

            function isObject (o) {
              return o && 'object' === typeof o
            }

            //add all the api methods to the emitter recursively
            function recurse (obj, manifest, path, remoteCall) {
              for(var name in manifest) (function (name, type) {
                var _path = path ? path.concat(name) : [name];
                obj[name] =
                    isObject(type)
                  ? recurse({}, type, _path, remoteCall)
                  : function () {
                      return remoteCall(type, _path, [].slice.call(arguments))
                    };
              })(name, manifest[name]);
              return obj
            }


            function noop (err) {
              if (err) {
                throw explainError(err, 'callback not provided')
              }
            }

            const promiseTypes = [
              'sync',
              'async'
            ];

            var remoteApi = function (obj, manifest, _remoteCall, bootstrap) {
              obj = obj || {};

              function remoteCall(type, name, args) {
                var cb = isFunction$2 (args[args.length - 1])
                  ? args.pop()
                  : promiseTypes.includes(type)
                    ? null
                    : noop;
                var value;

                if (typeof cb === 'function') {
                  // Callback style
                  try { value = _remoteCall(type, name, args, cb); }
                  catch(err) { return util.errorAsStreamOrCb(type, err, cb)}

                  return value
                } else {
                  // Promise style
                  return new Promise((resolve, reject) =>
                    _remoteCall(type, name, args, (err, val) => {
                      if (err) {
                        reject(err);
                      } else {
                        resolve(val);
                      }
                    })
                  )
                }
              }


              if (bootstrap) {
                remoteCall('async', 'manifest', [function (err, remote) {
                  if(err)
                    return bootstrap(err)
                  recurse(obj, remote, null, remoteCall);
                  bootstrap(null, remote, obj);
                }]);
              } else {
                recurse(obj, manifest, null, remoteCall);
              }

              return obj
            };

            var isArray$1 = Array.isArray;

            function isFunction$3 (f) {
              return 'function' === typeof f
            }

            function toArray(str) {
              return isArray$1(str) ? str : str.split('.')
            }

            function isPerms (p) {
              return (
                p &&
                isFunction$3(p.pre) &&
                isFunction$3(p.test) &&
                isFunction$3(p.post)
              )
            }

            /*

            perms:

            a given capability may be permitted to call a particular api.
            but only if a perms function returns true for the arguments
            it passes.

            suppose, an app may be given access, but may only create functions
            with it's own properties.

            create perms:
              {
                allow: ['add', 'query'], deny: [...],
                rules: {
                  add: {
                    call: function (value) {
                      return (value.type === 'task' || value.type === '_task')
                    },
                  query: {
                    call: function (value) {
                      safe.contains(value, {path: ['content', 'type'], eq: 'task'}) ||
                      safe.contains(value, {path: ['content', 'type'], eq: '_task'})
                    },
                    filter: function (value) {
                      return (value.type === 'task' || value.type === '_task')
                    }
                  }
                }
              }
            */

            var permissions = function (opts) {
              if(isPerms(opts)) return opts
              if(isFunction$3(opts)) return {pre: opts}
              var allow = null;
              var deny = {};

              function perms (opts) {
                if(opts.allow) {
                  allow = {};
                  opts.allow.forEach(function (path) {
                    util.set(allow, toArray(path), true);
                  });
                }
                else allow = null;

                if(opts.deny)
                  opts.deny.forEach(function (path) {
                    util.set(deny, toArray(path), true);
                  });
                else deny = {};

                return this
              }

              if(opts) perms(opts);

              perms.pre = function (name) {
                name = isArray$1(name) ? name : [name];
                if(allow && !util.prefix(allow, name))
                  return new Error('method:'+name + ' is not in list of allowed methods')

                if(deny && util.prefix(deny, name))
                  return new Error('method:'+name + ' is on list of disallowed methods')
              };

              perms.post = function () {
                //TODO
              };

              //alias for pre, used in tests.
              perms.test = function (name) {
                return perms.pre(name)
              };

              perms.get = function () {
                return {allow: allow, deny: deny}
              };

              return perms
            };

            var localApi = 

            function createLocalCall(api, manifest, perms) {
              perms = permissions(perms);

              function has(type, name) {
                return type === util.get(manifest, name)
              }

              function localCall(type, name, args) {

                if(name === 'emit')
                  throw new Error('emit has been removed')

                //is there a way to know whether it's sync or async?
                if(type === 'async')
                  if(has('sync', name)) {
                    var cb = args.pop(), value;
                    try { value = util.get(api, name).apply(this, args); }
                    catch (err) { return cb(err) }
                    return cb(null, value)
                  }

                if (!has(type, name))
                  throw new Error('no '+type+':'+name)

                return util.get(api, name).apply(this, args)
              }

              return function (type, name, args) {
                var err = perms.pre(name, args);
                if(err) throw err
                return localCall.call(this, type, name, args)
              }
            };

            var domain;

            // This constructor is used to store event handlers. Instantiating this is
            // faster than explicitly calling `Object.create(null)` to get a "clean" empty
            // object (tested with v8 v4.9).
            function EventHandlers() {}
            EventHandlers.prototype = Object.create(null);

            function EventEmitter() {
              EventEmitter.init.call(this);
            }

            // nodejs oddity
            // require('events') === require('events').EventEmitter
            EventEmitter.EventEmitter = EventEmitter;

            EventEmitter.usingDomains = false;

            EventEmitter.prototype.domain = undefined;
            EventEmitter.prototype._events = undefined;
            EventEmitter.prototype._maxListeners = undefined;

            // By default EventEmitters will print a warning if more than 10 listeners are
            // added to it. This is a useful default which helps finding memory leaks.
            EventEmitter.defaultMaxListeners = 10;

            EventEmitter.init = function() {
              this.domain = null;
              if (EventEmitter.usingDomains) {
                // if there is an active domain, then attach to it.
                if (domain.active ) ;
              }

              if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
                this._events = new EventHandlers();
                this._eventsCount = 0;
              }

              this._maxListeners = this._maxListeners || undefined;
            };

            // Obviously not all Emitters should be limited to 10. This function allows
            // that to be increased. Set to zero for unlimited.
            EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
              if (typeof n !== 'number' || n < 0 || isNaN(n))
                throw new TypeError('"n" argument must be a positive number');
              this._maxListeners = n;
              return this;
            };

            function $getMaxListeners(that) {
              if (that._maxListeners === undefined)
                return EventEmitter.defaultMaxListeners;
              return that._maxListeners;
            }

            EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
              return $getMaxListeners(this);
            };

            // These standalone emit* functions are used to optimize calling of event
            // handlers for fast cases because emit() itself often has a variable number of
            // arguments and can be deoptimized because of that. These functions always have
            // the same number of arguments and thus do not get deoptimized, so the code
            // inside them can execute faster.
            function emitNone(handler, isFn, self) {
              if (isFn)
                handler.call(self);
              else {
                var len = handler.length;
                var listeners = arrayClone(handler, len);
                for (var i = 0; i < len; ++i)
                  listeners[i].call(self);
              }
            }
            function emitOne(handler, isFn, self, arg1) {
              if (isFn)
                handler.call(self, arg1);
              else {
                var len = handler.length;
                var listeners = arrayClone(handler, len);
                for (var i = 0; i < len; ++i)
                  listeners[i].call(self, arg1);
              }
            }
            function emitTwo(handler, isFn, self, arg1, arg2) {
              if (isFn)
                handler.call(self, arg1, arg2);
              else {
                var len = handler.length;
                var listeners = arrayClone(handler, len);
                for (var i = 0; i < len; ++i)
                  listeners[i].call(self, arg1, arg2);
              }
            }
            function emitThree(handler, isFn, self, arg1, arg2, arg3) {
              if (isFn)
                handler.call(self, arg1, arg2, arg3);
              else {
                var len = handler.length;
                var listeners = arrayClone(handler, len);
                for (var i = 0; i < len; ++i)
                  listeners[i].call(self, arg1, arg2, arg3);
              }
            }

            function emitMany(handler, isFn, self, args) {
              if (isFn)
                handler.apply(self, args);
              else {
                var len = handler.length;
                var listeners = arrayClone(handler, len);
                for (var i = 0; i < len; ++i)
                  listeners[i].apply(self, args);
              }
            }

            EventEmitter.prototype.emit = function emit(type) {
              var er, handler, len, args, i, events, domain;
              var doError = (type === 'error');

              events = this._events;
              if (events)
                doError = (doError && events.error == null);
              else if (!doError)
                return false;

              domain = this.domain;

              // If there is no 'error' event listener then throw.
              if (doError) {
                er = arguments[1];
                if (domain) {
                  if (!er)
                    er = new Error('Uncaught, unspecified "error" event');
                  er.domainEmitter = this;
                  er.domain = domain;
                  er.domainThrown = false;
                  domain.emit('error', er);
                } else if (er instanceof Error) {
                  throw er; // Unhandled 'error' event
                } else {
                  // At least give some kind of context to the user
                  var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
                  err.context = er;
                  throw err;
                }
                return false;
              }

              handler = events[type];

              if (!handler)
                return false;

              var isFn = typeof handler === 'function';
              len = arguments.length;
              switch (len) {
                // fast cases
                case 1:
                  emitNone(handler, isFn, this);
                  break;
                case 2:
                  emitOne(handler, isFn, this, arguments[1]);
                  break;
                case 3:
                  emitTwo(handler, isFn, this, arguments[1], arguments[2]);
                  break;
                case 4:
                  emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
                  break;
                // slower
                default:
                  args = new Array(len - 1);
                  for (i = 1; i < len; i++)
                    args[i - 1] = arguments[i];
                  emitMany(handler, isFn, this, args);
              }

              return true;
            };

            function _addListener(target, type, listener, prepend) {
              var m;
              var events;
              var existing;

              if (typeof listener !== 'function')
                throw new TypeError('"listener" argument must be a function');

              events = target._events;
              if (!events) {
                events = target._events = new EventHandlers();
                target._eventsCount = 0;
              } else {
                // To avoid recursion in the case that type === "newListener"! Before
                // adding it to the listeners, first emit "newListener".
                if (events.newListener) {
                  target.emit('newListener', type,
                              listener.listener ? listener.listener : listener);

                  // Re-assign `events` because a newListener handler could have caused the
                  // this._events to be assigned to a new object
                  events = target._events;
                }
                existing = events[type];
              }

              if (!existing) {
                // Optimize the case of one listener. Don't need the extra array object.
                existing = events[type] = listener;
                ++target._eventsCount;
              } else {
                if (typeof existing === 'function') {
                  // Adding the second element, need to change to array.
                  existing = events[type] = prepend ? [listener, existing] :
                                                      [existing, listener];
                } else {
                  // If we've already got an array, just append.
                  if (prepend) {
                    existing.unshift(listener);
                  } else {
                    existing.push(listener);
                  }
                }

                // Check for listener leak
                if (!existing.warned) {
                  m = $getMaxListeners(target);
                  if (m && m > 0 && existing.length > m) {
                    existing.warned = true;
                    var w = new Error('Possible EventEmitter memory leak detected. ' +
                                        existing.length + ' ' + type + ' listeners added. ' +
                                        'Use emitter.setMaxListeners() to increase limit');
                    w.name = 'MaxListenersExceededWarning';
                    w.emitter = target;
                    w.type = type;
                    w.count = existing.length;
                    emitWarning(w);
                  }
                }
              }

              return target;
            }
            function emitWarning(e) {
              typeof console.warn === 'function' ? console.warn(e) : console.log(e);
            }
            EventEmitter.prototype.addListener = function addListener(type, listener) {
              return _addListener(this, type, listener, false);
            };

            EventEmitter.prototype.on = EventEmitter.prototype.addListener;

            EventEmitter.prototype.prependListener =
                function prependListener(type, listener) {
                  return _addListener(this, type, listener, true);
                };

            function _onceWrap(target, type, listener) {
              var fired = false;
              function g() {
                target.removeListener(type, g);
                if (!fired) {
                  fired = true;
                  listener.apply(target, arguments);
                }
              }
              g.listener = listener;
              return g;
            }

            EventEmitter.prototype.once = function once(type, listener) {
              if (typeof listener !== 'function')
                throw new TypeError('"listener" argument must be a function');
              this.on(type, _onceWrap(this, type, listener));
              return this;
            };

            EventEmitter.prototype.prependOnceListener =
                function prependOnceListener(type, listener) {
                  if (typeof listener !== 'function')
                    throw new TypeError('"listener" argument must be a function');
                  this.prependListener(type, _onceWrap(this, type, listener));
                  return this;
                };

            // emits a 'removeListener' event iff the listener was removed
            EventEmitter.prototype.removeListener =
                function removeListener(type, listener) {
                  var list, events, position, i, originalListener;

                  if (typeof listener !== 'function')
                    throw new TypeError('"listener" argument must be a function');

                  events = this._events;
                  if (!events)
                    return this;

                  list = events[type];
                  if (!list)
                    return this;

                  if (list === listener || (list.listener && list.listener === listener)) {
                    if (--this._eventsCount === 0)
                      this._events = new EventHandlers();
                    else {
                      delete events[type];
                      if (events.removeListener)
                        this.emit('removeListener', type, list.listener || listener);
                    }
                  } else if (typeof list !== 'function') {
                    position = -1;

                    for (i = list.length; i-- > 0;) {
                      if (list[i] === listener ||
                          (list[i].listener && list[i].listener === listener)) {
                        originalListener = list[i].listener;
                        position = i;
                        break;
                      }
                    }

                    if (position < 0)
                      return this;

                    if (list.length === 1) {
                      list[0] = undefined;
                      if (--this._eventsCount === 0) {
                        this._events = new EventHandlers();
                        return this;
                      } else {
                        delete events[type];
                      }
                    } else {
                      spliceOne(list, position);
                    }

                    if (events.removeListener)
                      this.emit('removeListener', type, originalListener || listener);
                  }

                  return this;
                };

            EventEmitter.prototype.removeAllListeners =
                function removeAllListeners(type) {
                  var listeners, events;

                  events = this._events;
                  if (!events)
                    return this;

                  // not listening for removeListener, no need to emit
                  if (!events.removeListener) {
                    if (arguments.length === 0) {
                      this._events = new EventHandlers();
                      this._eventsCount = 0;
                    } else if (events[type]) {
                      if (--this._eventsCount === 0)
                        this._events = new EventHandlers();
                      else
                        delete events[type];
                    }
                    return this;
                  }

                  // emit removeListener for all listeners on all events
                  if (arguments.length === 0) {
                    var keys = Object.keys(events);
                    for (var i = 0, key; i < keys.length; ++i) {
                      key = keys[i];
                      if (key === 'removeListener') continue;
                      this.removeAllListeners(key);
                    }
                    this.removeAllListeners('removeListener');
                    this._events = new EventHandlers();
                    this._eventsCount = 0;
                    return this;
                  }

                  listeners = events[type];

                  if (typeof listeners === 'function') {
                    this.removeListener(type, listeners);
                  } else if (listeners) {
                    // LIFO order
                    do {
                      this.removeListener(type, listeners[listeners.length - 1]);
                    } while (listeners[0]);
                  }

                  return this;
                };

            EventEmitter.prototype.listeners = function listeners(type) {
              var evlistener;
              var ret;
              var events = this._events;

              if (!events)
                ret = [];
              else {
                evlistener = events[type];
                if (!evlistener)
                  ret = [];
                else if (typeof evlistener === 'function')
                  ret = [evlistener.listener || evlistener];
                else
                  ret = unwrapListeners(evlistener);
              }

              return ret;
            };

            EventEmitter.listenerCount = function(emitter, type) {
              if (typeof emitter.listenerCount === 'function') {
                return emitter.listenerCount(type);
              } else {
                return listenerCount.call(emitter, type);
              }
            };

            EventEmitter.prototype.listenerCount = listenerCount;
            function listenerCount(type) {
              var events = this._events;

              if (events) {
                var evlistener = events[type];

                if (typeof evlistener === 'function') {
                  return 1;
                } else if (evlistener) {
                  return evlistener.length;
                }
              }

              return 0;
            }

            EventEmitter.prototype.eventNames = function eventNames() {
              return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
            };

            // About 1.5x faster than the two-arg version of Array#splice().
            function spliceOne(list, index) {
              for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
                list[i] = list[k];
              list.pop();
            }

            function arrayClone(arr, i) {
              var copy = new Array(i);
              while (i--)
                copy[i] = arr[i];
              return copy;
            }

            function unwrapListeners(arr) {
              var ret = new Array(arr.length);
              for (var i = 0; i < ret.length; ++i) {
                ret[i] = arr[i].listener || arr[i];
              }
              return ret;
            }

            var events = /*#__PURE__*/Object.freeze({
                        __proto__: null,
                        'default': EventEmitter,
                        EventEmitter: EventEmitter
            });

            var require$$0 = /*@__PURE__*/getAugmentedNamespace(events);

            var EventEmitter$1 = require$$0.EventEmitter;

            function createMuxrpc (remoteManifest, localManifest, localApi$1, id, perms, codec, legacy) {
              var bootstrap;
              if ('function' === typeof remoteManifest) {
                bootstrap = remoteManifest;
                remoteManifest = {};
              }

              localManifest = localManifest || {};
              remoteManifest = remoteManifest || {};
              var emitter = new EventEmitter$1();
              if(!codec) codec = packetStreamCodec;

              //pass the manifest to the permissions so that it can know
              //what something should be.
              var _cb;
              var context = {
                  _emit: function (event, value) {
                    emitter && emitter._emit(event, value);
                    return context
                  },
                  id: id
                };

              var ws = stream(
                localApi(localApi$1, localManifest, perms).bind(context),
                codec, function (err) {
                  if(emitter.closed) return
                  emitter.closed = true;
                  emitter.emit('closed');
                  if(_cb) {
                    var cb = _cb; _cb = null; cb(err);
                  }
                }
              );

              remoteApi(emitter, remoteManifest, function (type, name, args, cb) {
                if(ws.closed) throw new Error('stream is closed')
                return ws.remoteCall(type, name, args, cb)
              }, bootstrap);

              //legacy local emit, from when remote emit was supported.
              emitter._emit = emitter.emit;

              if(legacy) {
                Object.__defineGetter__.call(emitter, 'id', function () {
                  return context.id
                });

                Object.__defineSetter__.call(emitter, 'id', function (value) {
                  context.id =  value;
                });

                var first = true;

                emitter.createStream = function (cb) {
                  _cb = cb;
                  if(first) {
                    first = false; return ws
                  }
                  else
                    throw new Error('one stream per rpc')
                };
              }
              else
                emitter.stream = ws;

              emitter.closed = false;

              emitter.close = function (err, cb) {
                ws.close(err, cb);
                return this
              };

              return emitter
            }

            var muxrpc = function (remoteManifest, localManifest, codec) {
              if(arguments.length > 3)
                return createMuxrpc.apply(this, arguments)
              return function (local, perms, id) {
                return createMuxrpc(remoteManifest, localManifest, local, id, perms, codec, true)
              }
            };

            var looper = function (fn) {
              var active = false, called = 0;
              return function () {
                called = true;
                if(!active) {
                  active = true;
                  while(called) {
                    called = false;
                    fn();
                  }
                  active = false;
                }
              }
            };

            var pullParamap = function (map, width, inOrder) {
              inOrder = inOrder === undefined ? true : inOrder;
              var reading = false, abort;
              return function (read) {
                var i = 0, j = 0, last = 0;
                var seen = [], started = false, ended = false, _cb, error;

                function drain () {
                  if(_cb) {
                    var cb = _cb;
                    if(error) {
                      _cb = null;
                      return cb(error)
                    }
                    if(Object.hasOwnProperty.call(seen, j)) {
                      _cb = null;
                      var data = seen[j]; delete seen[j]; j++;
                      cb(null, data);
                      if(width) start();
                    } else if(j >= last && ended) {
                      _cb = null;
                      cb(ended);
                    }
                  }
                }

                var start = looper(function () {
                  started = true;
                  if(ended) return drain()
                  if(reading || width && (i - width >= j)) return
                  reading = true;
                  read(abort, function (end, data) {
                    reading = false;
                    if(end) {
                      last = i; ended = end;
                      drain();
                    } else {
                      var k = i++;

                      map(data, function (err, data) {
                        if (inOrder) seen[k] = data;
                        else seen.push(data);
                        if(err) error = err;
                        drain();
                      });

                      if(!ended)
                        start();

                    }
                  });
                });

                return function (_abort, cb) {
                  if(_abort)
                    read(ended = abort = _abort, function (err) {
                      if(cb) return cb(err)
                    });
                  else {
                    _cb = cb;
                    if(!started) start();
                    drain();
                  }
                }
              }
            };

            pullStream.pull.paraMap = pullParamap;

            window.pull = pullStream.pull;

            window.connectSsb = function() {
              return new Promise((resolve, reject) => {

                let messageDataCallback = null;
                let messageDataBuffer = [];

                const fromWebExt = function read(abort, cb) {
                  if (messageDataBuffer.length > 0) {
                    const data = messageDataBuffer[0];
                    messageDataBuffer = messageDataBuffer.splice(1);
                    cb(null, data);
                  } else {
                    messageDataCallback = cb;
                  }
                };


                window.addEventListener("message", (event) => {
                  if (event.source == window &&
                      event.data &&
                      event.data.direction == "from-content-script") {
                        const asBuffer = Buffer.from(event.data.message);
                        if (messageDataCallback) {
                          const _messageDataCallback = messageDataCallback;
                          messageDataCallback = null;
                          _messageDataCallback(null, asBuffer);
                        } else {
                          messageDataBuffer.push(asBuffer);
                        }
                  }
                });

                const toWebExt = function sink(done) {
                  return function (source) {
                    source(null, function more(end,data) {
                      if (end) return done()
                      window.postMessage({
                        direction: "from-page-script",
                        message: data
                      }, "*");
                      source(null, more);
                    });
                  }
                };
                const client = muxrpc(function (err, manifest) {
                  if (err) reject(err);
                  else {
                
                    //console.log(JSON.stringify(manifest,undefined, 2))
                  
                    console.log('adding client to window');
                    window.client = client;
                    
                    resolve(client);
                  }
                })();
                
                const onClose = () => {
                  console.log('connected to muxrpc server');
                }; 
                
                const clientStream = client.createStream(onClose);
                pullStream.pull(
                  fromWebExt,
                  clientStream,
                  toWebExt()
                );
              })
            };

}());
//# sourceMappingURL=connect-ssb.js.map
