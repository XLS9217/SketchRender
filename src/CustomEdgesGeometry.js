import { BufferGeometry } from 'three/src/core/BufferGeometry.js';
import { Float32BufferAttribute } from 'three/src/core/BufferAttribute.js';
import * as MathUtils from 'three/src/math/MathUtils.js';
import { Triangle } from 'three/src/math/Triangle.js';
import { Vector3 } from 'three/src/math/Vector3.js';

// Import necessary classes
const _v0 = /*@__PURE__*/ new Vector3();
const _v1 = /*@__PURE__*/ new Vector3();
const _v2 = /*@__PURE__*/ new Vector3();
const _normal = /*@__PURE__*/ new Vector3();
const _triangle = /*@__PURE__*/ new Triangle();


const triangle0 = new Triangle();
const triangle1 = new Triangle();

export default class CustomEdgesGeometry extends BufferGeometry {

	constructor(geometry = null, thresholdAngle = 1) {
		super();

		this.type = 'EdgesGeometry';

		this.parameters = {
			geometry: geometry,
			thresholdAngle: thresholdAngle
		};

		if (geometry !== null) {
			const precisionPoints = 4;
			const precision = Math.pow(10, precisionPoints);
			const thresholdDot = Math.cos(MathUtils.DEG2RAD * thresholdAngle);

			const indexAttr = geometry.getIndex();
			const positionAttr = geometry.getAttribute('position');
			const indexCount = indexAttr ? indexAttr.count : positionAttr.count;

			const indexArr = [0, 0, 0];
			const vertKeys = ['a', 'b', 'c'];
			const hashes = new Array(3);

			const edgeData = {};
			const vertices = [];
			const normals = []; // Array to store normals

			for (let i = 0; i < indexCount; i += 3) {
				if (indexAttr) {
					indexArr[0] = indexAttr.getX(i);
					indexArr[1] = indexAttr.getX(i + 1);
					indexArr[2] = indexAttr.getX(i + 2);
				} else {
					indexArr[0] = i;
					indexArr[1] = i + 1;
					indexArr[2] = i + 2;
				}

				const { a, b, c } = _triangle;
				a.fromBufferAttribute(positionAttr, indexArr[0]);
				b.fromBufferAttribute(positionAttr, indexArr[1]);
				c.fromBufferAttribute(positionAttr, indexArr[2]);
				_triangle.getNormal(_normal);

				// Create hashes for the edge from the vertices
				hashes[0] = `${Math.round(a.x * precision)},${Math.round(a.y * precision)},${Math.round(a.z * precision)}`;
				hashes[1] = `${Math.round(b.x * precision)},${Math.round(b.y * precision)},${Math.round(b.z * precision)}`;
				hashes[2] = `${Math.round(c.x * precision)},${Math.round(c.y * precision)},${Math.round(c.z * precision)}`;

				// Skip degenerate triangles
				if (hashes[0] === hashes[1] || hashes[1] === hashes[2] || hashes[2] === hashes[0]) {
					continue;
				}

				// Iterate over every edge
				for (let j = 0; j < 3; j++) {
					// Get the first and next vertex making up the edge
					const jNext = (j + 1) % 3;
					const jNext2 = (j + 2) % 3;
					const vecHash0 = hashes[j];
					const vecHash1 = hashes[jNext];
					const v0 = _triangle[vertKeys[j]];
					const v1 = _triangle[vertKeys[jNext]];
					const v2 = _triangle[vertKeys[jNext2]];

					const hash = `${vecHash0}_${vecHash1}`;
					const reverseHash = `${vecHash1}_${vecHash0}`;

					if (reverseHash in edgeData && edgeData[reverseHash]) {
						// If we found a sibling edge add it into the vertex array if it meets the angle threshold
						// and delete the edge from the map.
						// if (_normal.dot(edgeData[reverseHash].normal) <= thresholdDot) {
						// 	vertices.push(v0.x, v0.y, v0.z);
						// 	vertices.push(v1.x, v1.y, v1.z);

						// 	// Add normals for the edges
						// 	normals.push(_normal.x, _normal.y, _normal.z);
						// 	normals.push(_normal.x, _normal.y, _normal.z);
						// }
						edgeData[reverseHash].surfaceVertex1 = v2
						edgeData[reverseHash].normal2 = _normal.clone()

					} else if (!(hash in edgeData)) {
						// If we've already got an edge here then skip adding a new one
						edgeData[hash] = {
							index0: indexArr[j],
							index1: indexArr[jNext],

							surfaceVertex0: v2,
							surfaceVertex1: null,

							normal: _normal.clone(),
							normal2: null
						};
					}
				}
			}

			let surfaceVertex0Arr = []
			let surfaceVertex1Arr = []

			let normal2Arr = []

			// Iterate over all remaining, unmatched edges and add them to the vertex array
			for (const key in edgeData) {
				if (edgeData[key]) {
					const { index0, index1,} = edgeData[key];

					if(!edgeData[key].normal2 || edgeData[key].normal.dot(edgeData[key].normal2) >= 0.01){
						continue;
					}

					_v0.fromBufferAttribute(positionAttr, index0);
					_v1.fromBufferAttribute(positionAttr, index1);

					vertices.push(_v0.x, _v0.y, _v0.z);
					vertices.push(_v1.x, _v1.y, _v1.z);

					// Add normals for the edges
					const normal = edgeData[key].normal;
					normals.push(normal.x, normal.y, normal.z);
					normals.push(normal.x, normal.y, normal.z);

					normal2Arr.push( edgeData[key].normal2.x , edgeData[key].normal2.y ,edgeData[key].normal2.z)
					normal2Arr.push( edgeData[key].normal2.x , edgeData[key].normal2.y ,edgeData[key].normal2.z)

					// surfaceVertex0Arr.push(edgeData[key].surfaceVertex0.x , edgeData[key].surfaceVertex0.y ,edgeData[key].surfaceVertex0.z)
					// surfaceVertex1Arr.push(edgeData[key].surfaceVertex1.x , edgeData[key].surfaceVertex1.y ,edgeData[key].surfaceVertex1.z)

				}
			}

			this.setAttribute('position', new Float32BufferAttribute(vertices, 3));
			this.setAttribute('normal', new Float32BufferAttribute(normals, 3));
			this.setAttribute('normal2', new Float32BufferAttribute(normal2Arr, 3));
		}
	}

	copy(source) {
		super.copy(source);
		this.parameters = Object.assign({}, source.parameters);
		return this;
	}
}
