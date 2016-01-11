var path = require( 'path' ),
    express = require( 'express' ),
    winston = require( 'winston' ),
    oraObserver = require( './oraObserver' );

var pngToNiceName = function ( name ) {
    return name
        .substring( 0, name.lastIndexOf( '.' ) )
        .split( '_' )
        .map( ( s ) => s[ 0 ].toUpperCase() + s.substring( 1 ) )
        .join( ' ' );
};

/**
 *
 * @param {{boardDir: string, port:number, sharedFs:boolean, title:string}} options
 * <ul>
 * <li>boardDir: Path to the directory containing the ORA files</li>
 * <li>Port: Port number where the server will be listening</li>
 * <li>sharedFs: Use the stable fs.watchFile() instead of fs.watch(), e.g. for network shares.
 * fs.watch() does not work on network shares, or on virtual machine shared folders.</li>
 * <li>interval: If sharedFs is true, specifies the polling interval to check for changes.</li>
 * <li>title: Page title</li>
 * </ul>
 */
var startOraBoard = function ( options ) {

    var boardDir = options.boardDir,
        imageDir = path.join( __dirname, 'public', 'cache' ),
        observer = oraObserver.observe( boardDir, imageDir, options ),
        port = options.port || 3311;

    var app = express();

    app.use( express.static( path.join( __dirname, 'public' ) ) );

    winston.log( 'debug', observer );

    observer.on( 'update', ( path ) => {
        winston.log( 'info', 'UPDATED!', path );
    } );

    app.get( '/collections/0', function ( req, res ) {
        res.json( {
            title: options.title || 'Live ORA Whiteboard'
        } );
    } );

    app.get( '/boards', function ( req, res ) {
        res.json( {
            uris: [
                '/list',
                '/name'
            ]
        } );
    } );
    app.get( '/boards/list', function ( req, res ) {
        res.json( {
            boards: observer.watchedFilesDetails().map( function ( data ) {
                data.url = '/boards/name/' + data.name + '/image?rev=' + data.rev;
                data.niceName = pngToNiceName( data.name );
                return data;
            } )
        } );
    } );
    app.get( '/boards/name', function ( req, res ) {
        res.json( { uris: observer.watchedFiles() } );
    } );
    app.get( '/boards/name/:name', function ( req, res ) {
        if ( observer.hasImage( req.params.name ) ) {
            res.json( { uris: [ '/image' ] } )
        } else {
            res.status( 404 ).json( { message: 'Image does not exist' } );
        }
    } );
    app.get( '/boards/name/:name/image', function ( req, res ) {
        if ( observer.hasImage( req.params.name ) ) {
            res.sendFile( observer.fullImagePath( req.params.name ) );
        } else {
            winston.log( 'debug', req.params.name );
            res.status( 404 ).json( { message: 'Image does not exist' } );
        }
    } );
    app.get( '/boards/zip', function ( req, res ) {
        observer.zip( ( err, archive ) => {
            res.header( {
                'Content-Type': 'application/zip',
                'Content-Length': archive.pointer(),
                'Content-Disposition': 'attachment;filename=Whiteboards-' + (new Date().getTime()) + '.zip'
            } );
            archive.pipe( res );
        } );
    } );

    app.listen( port );

    return app;
};

module.exports = {
    startOraBoard,
    /**
     * @param {string} level info, debug, or warn.
     */
    set logLevel( level ) {
        winston.level = level;
    }
};