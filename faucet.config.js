module.exports = {
  apps: [
    {
      name: 'Faucet',
      script: './faucet.js',
      node_args: '-r esm --experimental-modules',
    },
  ],
};