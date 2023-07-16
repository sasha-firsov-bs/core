const treeify = require('object-treeify');
export class Tree {
    nodes = {};
    insert(child, value = new Tree()) {
        this.nodes[child] = value;
        return this;
    }
    search(key) {
        for (const child of Object.keys(this.nodes)) {
            if (child === key) {
                return this.nodes[child];
            }
            const c = this.nodes[child].search(key);
            if (c)
                return c;
        }
    }
    display(logger = console.log) {
        const addNodes = function (nodes) {
            const tree = {};
            for (const p of Object.keys(nodes)) {
                tree[p] = addNodes(nodes[p].nodes);
            }
            return tree;
        };
        const tree = addNodes(this.nodes);
        logger(treeify(tree));
    }
}
export default function tree() {
    return new Tree();
}
