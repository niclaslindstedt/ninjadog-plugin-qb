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
  if (torrent.progress < 1) return reason;

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
const daysAgo = unixTime => {
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
const removeFilename = path => {
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
const isTorrent = path => {
  return path.endsWith('.torrent');
};

module.exports = {
  daysAgo,
  shouldRemoveTorrent,
  removeFilename,
  isTorrent
};
