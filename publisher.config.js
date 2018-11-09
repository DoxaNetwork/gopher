module.exports = {
  apps: [
    {
      name: 'Publisher',
      script: './publisher.js',
      node_args: '-r esm --experimental-modules',
    },
  ],
};