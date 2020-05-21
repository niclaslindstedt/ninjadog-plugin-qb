/**
 * Determines whether or not the torrent should be removed
 * Returns:
 *
 * 0 - will not be removed
 *
 * 1 - torrent is on a public tracker
 *
 * 2 - seeded for # days
 *
 * 3 - seeded enough ratio
 *
 * @param {Object} torrent
 * @returns
 */
const shouldRemoveTorrent = (torrent, settings) => {
  let reason = 0;
  if (torrent.progress < 1) {
    return reason;
  }

  if (
    torrent.label == 'public' &&
    settings.removeTorrentWithPublicTrackerWhenComplete &&
    torrent.completion_on != null
  ) {
    reason = 1;
  }

  if (daysAgo(torrent.completion_on) >= settings.seed.days) {
    reason = 2;
  }

  if (torrent.ratio >= settings.seed.ratio) {
    reason = 3;
  }

  return reason;
};

/**
 * Calculate days between timestamp and now
 * @param {Number} unixTime
 * @returns {Number} number of days ago
 */
const daysAgo = (unixTime) => {
  const completed_on = new Date(+unixTime * 1000);
  const date_now = new Date();
  const msInADay = 8.64e7;
  return Math.floor(Math.abs(+completed_on - +date_now) / msInADay);
};

/**
 * Remove filename from path
 * @param {string} path
 * @returns
 */
const removeFilename = (path) => {
  if (path.match(/\\/)) {
    return path.substring(0, path.lastIndexOf('\\'));
  }
  if (path.match(/\//)) {
    return path.substring(0, path.lastIndexOf('/'));
  }
  return path;
};

/**
 * Check if path is a torrent file
 *
 * @param {string} path
 * @returns
 */
const isTorrent = (path) => {
  return path.endsWith('.torrent');
};

// https://stackoverflow.com/a/23945027
const extractHostname = (url) => {
  var hostname;
  // find & remove protocol (http, ftp, etc.) and get hostname

  if (url.indexOf('//') > -1) {
    hostname = url.split('/')[2];
  } else {
    hostname = url.split('/')[0];
  }

  // find & remove port number
  hostname = hostname.split(':')[0];
  // find & remove "?"
  hostname = hostname.split('?')[0];

  return hostname;
};

const extractRootDomain = (url) => {
  var domain = extractHostname(url),
    splitArr = domain.split('.'),
    arrLen = splitArr.length;

  /*
   * extracting the root domain here
   * if there is a subdomain
   */
  if (arrLen > 2) {
    domain = splitArr[arrLen - 2] + '.' + splitArr[arrLen - 1];
    // check to see if it's using a Country Code Top Level Domain (ccTLD) (i.e. ".me.uk")
    if (splitArr[arrLen - 2].length == 2 && splitArr[arrLen - 1].length == 2) {
      // this is using a ccTLD
      domain = splitArr[arrLen - 3] + '.' + domain;
    }
  }
  return domain.split('.').shift();
};

module.exports = {
  daysAgo,
  shouldRemoveTorrent,
  removeFilename,
  isTorrent,
  extractHostname,
  extractRootDomain,
};
