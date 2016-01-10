const
    fs = require( 'fs' ),
    path = require( 'path' ),
    util = require( 'util' ),
    EventEmitter = require( 'events' ),
    archiver = require( 'archiver' ),
    winston = require( 'winston' ),
    oti = require( 'ora-to-image' );

var nextId = (function () {
    var id = 0;
    return () => id++;
})();

/**
 * @param {EventEmitter=} emitter
 * @param {{oraPath:string, pngPath: string, sharedFs: boolean}} options
 * <ul>
 *      <li>sharedFs: Set to true when working with a shared file system
 *      which does not provide modification events.</li>
 *      <li>oraPath, pngPath: Paths to input ORA and output PNG file</li>
 * </ul>
 * @returns {EventEmitter} Events:
 * <ul>
 *     <li>update: When a PNG was updated</li>
 *     <li>delete: When an ORA file was removed</li>
 * </ul>
 */
var startWatcher = function ( options, emitter ) {

    var watchEnded = false,
        oraPath = options.oraPath,
        pngPath = options.pngPath,
        sharedFs = !!options.sharedFs,
        eventEmitter = emitter || new EventEmitter(),
        id = nextId();

    winston.log( 'info', 'Shared FS mode: ' + (sharedFs ? 'on' : 'off') );

    /**
     * @param {number} retries Number of retries
     */
    var toImage = ( retries ) => {
        winston.log( 'debug', id, 'Converting to PNG ...' );
        try {
            oti.oraToImage( oraPath, pngPath, function ( err ) {
                if ( err ) {
                    if ( retries > 0 ) {
                        winston.log( 'info', id, 'Failed generating ' + pngPath + ', trying again ... (' + err + ')' );
                        setTimeout( () => toImage( retries - 1 ), 100 );
                    } else {
                        winston.log( 'warn', id, 'Failed generating ' + pngPath );
                        winston.warn( err );
                    }
                } else {
                    winston.log( 'info', id, 'PNG generated: ', pngPath );
                    winston.log( 'debug', 'Emitter: ', eventEmitter );
                    eventEmitter.emit( 'update', pngPath );
                }
            } );
        } catch ( err ) {
            winston.log( 'warn', err );
        }
    };

    var watcher = function ( event, filename ) {
        if ( watchEnded ) {
            winston.log( 'debug', id, 'Event received although watch ended: ', event, filename );
            return;
        }

        if ( event === 'change' ) {
            winston.log( 'info', id, 'File changed:', filename );
            toImage( 1 );

        } else if ( event === 'rename' ) {
            winston.log( 'info', id, 'File was renamed: ', filename );
            watchEnded = true;
            startWatcher( options, eventEmitter );

        } else {
            winston.log( 'warn', id, 'Unknown event: ', event, filename );
        }

    };

    var fileWatcher = ( curr, prev ) => {
        if ( prev.mtime !== curr.mtime ) {
            winston.log( 'info', 'Modification time changed from ' + prev.mtime + ' to ' + curr.mtime );
            toImage( 1 );
        } else {
            winston.log( 'debug', 'File was not modified: ', curr, prev );
        }
    };

    var startWatching = function ( restart ) {
        winston.log( 'debug', 'Starting watcher ', id );
        var restarted = !!emitter;

        try {

            // Use watchFile for shared file systems,
            // and watch for those supporting events
            if ( sharedFs ) {
                fs.watchFile( oraPath, fileWatcher );
            } else {
                fs.watch( oraPath, watcher );
            }

            if ( !restarted ) {
                toImage( 1 );
            }

        } catch ( e ) {
            if ( restart ) {
                setTimeout( () => startWatching( false ), 100 );
            } else {
                winston.log( 'warn', 'Could not start watcher for ' + oraPath, e );
                if ( e.code === 'ENOENT' ) {
                    eventEmitter.emit( 'delete', pngPath );
                }
            }
        }
    };

    startWatching( true );

    return eventEmitter;
};


var WatchEntry = function ( ora, png ) {
    this.ora = ora;
    this.png = png;
    this.rev = 0;
    this.deleted = false;
};

var ObserverEmitter = function () {
    EventEmitter.call( this );

    /** @type {Array.<WatchEntry>} */
    this._watched = [];

    return this;
};
ObserverEmitter.prototype = {
    watchedFiles: function () {
        return this._watched.map( ( desc ) => path.basename( desc.png ) );
    },
    watchedFilesDetails: function () {
        return this._watched.map( ( desc ) => ({
            name: path.basename( desc.png ),
            rev: desc.rev,
            deleted: desc.deleted
        }) );
    },
    addWatched: function ( ora, png ) {
        var current = this._watched.filter( ( desc ) => desc.ora === ora );
        current.forEach( ( desc ) => winston.log( 'info', 'File is being watched already. Resetting if deleted. Was deleted: ', desc.deleted ) );
        if ( current.length > 0 ) {
            current.forEach( ( desc ) => desc.deleted = false );
        } else {
            this._watched.push( new WatchEntry( ora, png ) );
        }
    },
    isWatched: function ( ora ) {
        return this._watched.some( ( desc ) => desc.ora === ora && !desc.deleted );
    },
    hasImage: function ( png ) {
        return this._watched.some( ( desc ) => path.basename( desc.png ) === png );
    },
    fullImagePath: function ( png ) {
        return this._watched
            .filter( ( desc ) => path.basename( desc.png ) === png )
            .map( ( desc ) => desc.png )
            [ 0 ];
    },
    update: function ( png ) {
        winston.log( 'info', 'Revision update for ', png );
        this._watched.filter( ( desc ) => desc.png === png ).forEach( ( desc ) => {
            desc.rev++;
            winston.log( png, 'r' + desc.rev );
            this.emit( 'update', png );
        } );
    },
    delete: function ( png ) {
        winston.log( 'info', 'File was deleted: ', png );
        this._watched.filter( ( desc ) => desc.png === png ).forEach( ( desc ) => {
            desc.deleted = true;
            this.emit( 'delete', png );
        } );
    },
    /**
     * Zip all current boards.
     * @param {function(err, archive:Archiver|Stream)} callback
     * @returns {Archiver|Stream}
     */
    zip: function ( callback ) {
        var archive = archiver.create( 'zip', {} ),
            details = 'This ORA board snapshot contains the following files:';
        archive.on( 'finish', () => callback( null, archive ) );

        this._watched.forEach( ( desc ) => {
            archive.file( desc.png, {
                name: path.basename( desc.png ),
                prefix: 'boards'
            } );
            details += '\n* ' + path.basename( desc.png ) + ', r' + desc.rev;
        } );

        details += '\n\nCreated on ' + (new Date().toLocaleString());

        archive.append( details, {
            name: 'INFO.txt',
            prefix: 'boards'
        } );

        archive.finalize();
    }
};
util.inherits( ObserverEmitter, EventEmitter );

/**
 *
 * @param {string} boardDir
 * @param {string} outDir
 * @param {{sharedFs:boolean}} options
 * @returns {ObserverEmitter}
 */
function observe( boardDir, outDir, options ) {

    winston.log( 'info', 'Observing ', boardDir, ' and generating files to ', outDir );

    /** List of watched files. */
    var observerEmitter = new ObserverEmitter(),
        skipList = [];

    scan();

    function scan() {

        fs.readdir( boardDir, function ( err, files ) {

            if ( err ) {
                winston.log( 'warn', err );
            } else {

                // List files in directory, and watch new ones.
                files.forEach( ( f ) => {

                    var watcher,
                        oraPath,
                        pngPath;

                    // Only use .ora files, and ignore files which start with a .
                    if ( f.toLowerCase().endsWith( '.ora' ) && f[ 0 ] !== '.' ) {

                        oraPath = path.join( boardDir, f );
                        pngPath = path.join( outDir, f.substring( 0, f.length - 4 ) + '.png' );

                        // Watch this file, if it is not being watched already.
                        if ( !observerEmitter.isWatched( oraPath ) ) {

                            winston.log( 'info', 'ORA found: ', f );
                            observerEmitter.addWatched( oraPath, pngPath );
                            watcher = startWatcher( {
                                oraPath: oraPath,
                                pngPath: pngPath,
                                sharedFs: options.sharedFs
                            } );

                            watcher.on( 'update', ( path ) => {
                                observerEmitter.update( path );
                            } );
                            watcher.on( 'delete', ( path ) => {
                                observerEmitter.delete( path );
                            } )
                        }

                    } else if ( skipList.indexOf( f ) < 0 ) {
                        winston.log( 'info', 'Skipping ', f );
                        skipList.push( f );
                    }

                } );

            }
        } );

        // Scan again in a bit.
        setTimeout( scan, 4000 );
    }

    return observerEmitter;
}

module.exports = {
    observe
};