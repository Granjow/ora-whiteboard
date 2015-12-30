(function () {
    var app = angular.module( 'oraBoard', [] );

    app.controller( 'ThumbsController', [ '$http', '$interval', function ( $http, $interval ) {

        var me = this;

        this.imageData = [];
        this.selectedImage = '';

        this.imageClicked = function ( name ) {
            if ( me.selectedImage === name ) {
                me.selectedImage = '';
            } else {
                me.selectedImage = name;
            }
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

        $interval( reload, 1000 );

        reload();

    } ] );

})();
