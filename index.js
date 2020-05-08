const qb = require('@electorrent/node-qbittorrent');
const fs = require('fs-extra');
const parseTorrent = require('parse-torrent');
const prettyBytes = require('pretty-bytes');
const path = require('path');
const {
  shouldRemoveTorrent,
  removeFilename,
  isTorrent,
  extractRootDomain,
} = require('./helpers');
const { filename } = require(`${global.appRoot}/lib/helpers`);

/**
 * Qbittorrent.
 */
module.exports = class Qbittorrent {
  constructor() {
    this.construct(__dirname);
    /**
     * @type {String[]}
     * @description torrent hashes
     */
    this.currentlyDownloading = [];
  }

  get qbitsettings() {
    return {
      host: this.settings.host,
      port: this.settings.port,
      user: this.settings.username,
      pass: this.settings.password,
    };
  }

  async setup() {
    this.qb = new qb(this.qbitsettings);

    this.setupListeners();
    this.login();

    setTimeout(() => {
      if (global.Ninjakatt.plugins.has('Webserver')) {
        this.addWebroutes();
      }
    }, 0);
  }

  login() {
    this.qb.login(
      function (err) {
        if (err && err.code === 'ECONNREFUSED') {
          this.logError(
            `Could not connect to qBittorrent with these settings: ${JSON.stringify(
              this.qbitsettings
            )}`
          );
          setTimeout(() => {
            this.login();
          }, 60000);
        }
        this.checkSeed();
        this.checkDownload();
      }.bind(this)
    );
  }

  checkSeedTimer() {
    setTimeout(() => {
      this.checkSeed();
    }, 300000);
  }

  checkDownloadTimer() {
    setTimeout(() => {
      this.checkDownload();
    }, 5000);
  }

  /**
   * Connect to qbittorrent
   * @returns {qb}
   * @readonly
   */
  get client() {
    try {
      return this.qb;
    } catch (e) {
      console.log(e);
    }
  }

  checkDownload() {
    this.client.getTorrents((error, items) => {
      const currentlyDownloading = items.filter((x) => x.amount_left > 0);
      this.currentlyDownloading.forEach((hash) => {
        const torrentIndex = items.findIndex(
          (torrent) => torrent.hash === hash
        );
        const torrent = items[torrentIndex];
        if (torrent.amount_left === 0) {
          this.logInfo(`${torrent.name} has finished downloading`);
          global.emitter.emit(
            'qbittorrent.download-complete',
            torrent,
            'add',
            Qbittorrent.name
          );
        }
      });
      this.currentlyDownloading = currentlyDownloading.map((x) => x.hash);
      this.checkDownloadTimer();
    });
  }

  checkSeed(options) {
    const self = this;
    options = options || { label: 'public' };
    this.client.getTorrents((error, items) => {
      if (error || !items) {
        return;
      }

      items.forEach((torrent) => {
        if (shouldRemoveTorrent(torrent, this.settings) > 0) {
          this.client.delete(torrent.hash, (error) => {
            if (error) {
              this.logError(`Error removing ${torrent.name}`);
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

      this.logInfo(message);
    }
  }

  addTorrent(torrentPath) {
    const options = {
      savepath: removeFilename(torrentPath),
    };

    this.client.addTorrentFile(torrentPath, options, (error) => {
      if (error) {
        this.logError(`Error adding ${torrentPath}`);
        return;
      }
      this.logInfo(`Added ${filename(torrentPath)}`);
      this.moveTorrent(torrentPath);
    });
  }

  moveTorrent(torrentPath) {
    const tempPath = path.resolve(global.settingsPath, 'loadedTorrents');
    fs.ensureDirSync(tempPath);

    const newPath = `${tempPath}\\${filename(torrentPath)}`;

    return fs
      .move(torrentPath, newPath, { overwrite: true })
      .then(() => newPath)
      .catch((e) => {});
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
      (path) => {
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
        this.client.getTorrents((error, list) => {
          if (error) {
            return res.status(400).send();
          }
          res.status(200).send(
            list.map((item) => ({
              ...item,
              trackerName: extractRootDomain(item.tracker),
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
        this.client.syncMaindata((error, info) => {
          if (error) {
            return res.status(400).send();
          }
          res.status(200).send(info);
        });
      }
    );
  }
};
