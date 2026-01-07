/**
 * Tests for DocHub hierarchy processing
 * Run with: node --test mcp-bridge-server/hierarchy.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Mock buildHierarchyTree function (copy from utils/docHub.ts logic)
const buildHierarchyTree = (flatItems) => {
    const root = [];
    const stack = [];

    for (const flatItem of flatItems) {
        const itemWithChildren = { ...flatItem, children: [] };
        const currentDepth = flatItem.depth || 0;

        if (currentDepth === 0) {
            root.push(itemWithChildren);
            stack.length = 0;
            stack.push({ item: itemWithChildren, depth: 0 });
        } else {
            while (stack.length > 0 && stack[stack.length - 1].depth >= currentDepth) {
                stack.pop();
            }

            if (stack.length > 0) {
                const parent = stack[stack.length - 1].item;
                parent.children = parent.children || [];
                parent.children.push(itemWithChildren);
                stack.push({ item: itemWithChildren, depth: currentDepth });
            } else {
                root.push(itemWithChildren);
                stack.push({ item: itemWithChildren, depth: currentDepth });
            }
        }
    }
    return root;
};

describe('buildHierarchyTree', () => {
    it('should create flat structure for depth 0 items', () => {
        const flat = [
            { id: '1', key: 'tenders', name: '01_Tenders', enabled: true, depth: 0 },
            { id: '2', key: 'contracts', name: '02_Contracts', enabled: true, depth: 0 },
        ];
        const tree = buildHierarchyTree(flat);
        assert.strictEqual(tree.length, 2);
        assert.strictEqual(tree[0].name, '01_Tenders');
        assert.strictEqual(tree[1].name, '02_Contracts');
        assert.strictEqual(tree[0].children.length, 0);
        assert.strictEqual(tree[1].children.length, 0);
    });

    it('should nest items based on depth', () => {
        const flat = [
            { id: '1', key: 'tenders', name: '01_VR', enabled: true, depth: 0 },
            { id: '2', key: 'category', name: 'Kategorie', enabled: true, depth: 1 },
            { id: '3', key: 'supplier', name: 'Dodavatel', enabled: true, depth: 2 },
        ];
        const tree = buildHierarchyTree(flat);
        assert.strictEqual(tree.length, 1, 'Should have 1 root');
        assert.strictEqual(tree[0].name, '01_VR');
        assert.strictEqual(tree[0].children.length, 1, 'Root should have 1 child');
        assert.strictEqual(tree[0].children[0].name, 'Kategorie');
        assert.strictEqual(tree[0].children[0].children.length, 1, 'Category should have 1 child');
        assert.strictEqual(tree[0].children[0].children[0].name, 'Dodavatel');
    });

    it('should handle multiple roots with nested children', () => {
        const flat = [
            { id: '1', key: 'custom', name: '01_PD', enabled: true, depth: 0 },
            { id: '2', key: 'tenders', name: '02_VR', enabled: true, depth: 0 },
            { id: '3', key: 'category', name: 'Kategorie', enabled: true, depth: 1 },
            { id: '4', key: 'custom', name: '03_Smlouvy', enabled: true, depth: 0 },
        ];
        const tree = buildHierarchyTree(flat);
        assert.strictEqual(tree.length, 3, 'Should have 3 roots');
        assert.strictEqual(tree[0].name, '01_PD');
        assert.strictEqual(tree[1].name, '02_VR');
        assert.strictEqual(tree[1].children.length, 1);
        assert.strictEqual(tree[1].children[0].name, 'Kategorie');
        assert.strictEqual(tree[2].name, '03_Smlouvy');
    });

    it('should handle depth jumps (indent from 0 to 2)', () => {
        const flat = [
            { id: '1', key: 'root', name: 'Root', enabled: true, depth: 0 },
            { id: '2', key: 'deep', name: 'Deep', enabled: true, depth: 2 },
        ];
        const tree = buildHierarchyTree(flat);
        // Deep should still be child of Root even with depth jump
        assert.strictEqual(tree.length, 1);
        assert.strictEqual(tree[0].children.length, 1);
        assert.strictEqual(tree[0].children[0].name, 'Deep');
    });

    it('should handle siblings at same depth', () => {
        const flat = [
            { id: '1', key: 'root', name: 'Root', enabled: true, depth: 0 },
            { id: '2', key: 'child1', name: 'Child1', enabled: true, depth: 1 },
            { id: '3', key: 'child2', name: 'Child2', enabled: true, depth: 1 },
        ];
        const tree = buildHierarchyTree(flat);
        assert.strictEqual(tree.length, 1);
        assert.strictEqual(tree[0].children.length, 2);
        assert.strictEqual(tree[0].children[0].name, 'Child1');
        assert.strictEqual(tree[0].children[1].name, 'Child2');
    });
});

console.log('Run tests with: node --test mcp-bridge-server/hierarchy.test.js');
