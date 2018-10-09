const Base = require('ninjakatt-plugin-base');
const qb = require('qbittorrent-api');
const fs = require('fs-extra');
const parseTorrent = require('parse-torrent');
const prettyBytes = require('pretty-bytes');
const {
  shouldRemoveTorrent,
  removeFilename,
  isTorrent,
  extractRootDomain
} = require('./helpers');
const { filename } = require(`${global.appRoot}/lib/helpers`);

/**
 * Qbittorrent.
 */
module.exports = class Qbittorrent extends Base {
  constructor() {
    super(__dirname);
  }

  setup() {
    this.setupListeners();
    this.checkSeed();

    setTimeout(() => {
      if (global.Ninjakatt.plugins.has('Webserver')) {
        this.addWebroutes();
      }
    }, 0);
  }

  checkSeedTimer() {
    setTimeout(() => {
      this.checkSeed();
    }, 300000);
  }
  /**
   * Connect to qbittorrent
   * @returns {qb.connect}
   * @readonly
   */
  get client() {
    return qb.connect(
      `http://${this.settings.host}:${this.settings.port}`,
      this.settings.username,
      this.settings.password
    );
  }

  checkSeed(options) {
    const self = this;
    options = options || { label: 'public' };
    this.client.seeding(options, (error, items) => {
      if (error) {
        return;
      }
      items.forEach(torrent => {
        if (shouldRemoveTorrent(torrent, this.settings) > 0) {
          this.client.delete(torrent, error => {
            if (error) {
              global.emitter.emit(
                'message',
                `Error removing ${torrent.name}`,
                'error',
                Qbittorrent.name
              );
              return;
            }
            sendRemoveMessage(
              shouldRemoveTorrent(torrent, this.settings),
              torrent
            );
          });
        }
      });

      this.checkSeedTimer();
    });

    function sendRemoveMessage(status, torrent) {
      let message;
      const name = torrent.name.replace('.torrent').replace('.', ' ');

      switch (status) {
        case 1:
          message = `Removed ${name} because it was on a public tracker.`;
          break;
        case 2:
          message = `Removed ${name} because it has been seeded long enough. ${self.seedInfo(
            torrent
          )}`;
          break;
        case 3:
          message = `Removed ${name} because the ratio was enough. ${self.seedInfo(
            torrent
          )}`;
          break;
        default:
          message = `Removed ${name}. ${self.seedInfo(torrent)}`;
      }

      global.emitter.emit('message', message, 'remove', Qbittorrent.name);
    }
  }

  addTorrent(torrentPath) {
    this.client.add(torrentPath, removeFilename(torrentPath), '', error => {
      if (error) {
        global.emitter.emit(
          'message',
          `Error adding ${torrentPath}`,
          'error',
          Qbittorrent.name
        );
        return;
      }
      global.emitter.emit(
        'message',
        `Added ${filename(torrentPath)}`,
        'add',
        Qbittorrent.name
      );
      this.moveTorrent(torrentPath);
    });
  }

  moveTorrent(torrentPath) {
    fs.ensureDirSync(this.settings.loadedTorrentsPath);

    const newPath = `${this.settings.loadedTorrentsPath}\\${filename(
      torrentPath
    )}`;

    return fs
      .move(torrentPath, newPath, { overwrite: true })
      .then(() => newPath)
      .catch(e => {});
  }

  getTorrentInfo(torrentPath) {
    return parseTorrent(fs.readFileSync(torrentPath));
  }

  seedInfo(torrent) {
    return `[UL: ${prettyBytes(torrent.uploaded)} RATIO: ${Number(
      torrent.ratio
    ).toFixed(2)}]`;
  }

  setupListeners() {
    global.emitter.register(
      'file.add',
      path => {
        if (isTorrent(path)) {
          setTimeout(() => this.addTorrent(path), 2000);
        }
      },
      Qbittorrent.name
    );
  }

  addWebroutes() {
    const prefix = Qbittorrent.name.toLowerCase();

    emitter.emit(
      'webserver.add-route',
      'get',
      `/${prefix}/list`,
      (req, res) => {
        this.client.all('', {}, (error, list) => {
          res.status(200).send(
            list.map(item => ({
              ...item,
              trackerName: extractRootDomain(item.tracker)
            }))
          );
        });
      }
    );

    emitter.emit(
      'webserver.add-route',
      'get',
      `/${prefix}/transferinfo`,
      (req, res) => {
        this.client.transferInfo((error, info) => {
          res.status(200).send(info);
        });
      }
    );
  }
};
