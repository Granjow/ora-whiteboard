var path = require( 'path' ),
    express = require( 'express' ),
    oraObserver = require( './oraObserver' );

/**
 *
 * @param {string} boardDir
 * @param {number} port
 * @returns {*}
 */
var startOraBoard = function ( boardDir, port ) {

    var imageDir = path.join( __dirname, 'public', 'cache' ),
        observer = oraObserver.observe( boardDir, imageDir );

    var app = express();

    app.use( express.static( 'public' ) );

    console.log( observer );

    observer.on( 'update', ( path ) => {
        console.log( 'UPDATED!', path );
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
                data.niceName = data.name[ 0 ].toUpperCase() + data.name.replace( '.png', '' ).substring( 1 );
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
            console.log( req.params.name );
            res.status( 404 ).json( { message: 'Image does not exist' } );
        }
    } );

    app.listen( port );

    return app;
};

module.exports = {
    startOraBoard
};