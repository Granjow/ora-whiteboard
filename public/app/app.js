(function () {
    var app = angular.module( 'oraBoard', [] );

    app.controller( 'ThumbsController', [ '$http', '$interval', function ( $http, $interval ) {

        var me = this;

        this.imageData = [];
        this.selectedImage = '';

        this.imageClicked = function ( name ) {
            var changed = name !== me.selectedImage;
            if ( me.selectedImage === name ) {
                me.selectedImage = '';
            } else {
                me.selectedImage = name;
            }
            return changed;
        };


        var reload = function () {
            $http.get( '/boards/list/' ).then( function ( response ) {
                console.log( 'Data received: ', response );

                var boards = response.data.boards;
                boards.forEach( function ( board ) {
                    var ourBoard = me.imageData.find( function ( el ) {
                        return el.name === board.name;
                    } );

                    if ( !ourBoard ) {
                        me.imageData.push( board );
                    } else {
                        if ( ourBoard.rev !== board.rev ) {
                            console.log( 'Board was updated:', ourBoard, board );
                            for ( var prop in board ) {
                                if ( board.hasOwnProperty( prop ) ) {
                                    ourBoard[ prop ] = board[ prop ];
                                }
                            }
                        }
                    }
                } );

            }, function ( err ) {
                console.warn( 'Failed: ', err );
            } );
        };

        document.addEventListener( 'keypress', function ( key ) {
            if ( key.keyCode === 27 ) {
                return !me.imageClicked( '' );
            }
            return true;
        } );

        $interval( reload, 1000 );

        reload();

    } ] );

})();
