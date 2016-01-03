(function () {
    var app = angular.module( 'oraBoard', [] );

    app.factory( 'whiteboardService', [ '$http', '$interval', function ( $http, $interval ) {

        var imageData = [];
        var selectedImage = '';

        var imageClicked = function ( name ) {
            console.log( 'Selecting image ', name );
            var changed = name !== selectedImage;
            if ( selectedImage === name ) {
                selectedImage = '';
            } else {
                selectedImage = name;
            }
            return changed;
        };

        var isSelected = function ( name ) {
            return selectedImage === name;
        };


        var reload = function () {
            $http.get( '/boards/list/' ).then( function ( response ) {
                console.log( 'Data received: ', response );

                var boards = response.data.boards;
                boards.forEach( function ( board ) {
                    var ourBoard = imageData.find( function ( el ) {
                        return el.name === board.name;
                    } );

                    if ( !ourBoard ) {
                        imageData.push( board );
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
                return !imageClicked( '' );
            }
            return true;
        } );

        $interval( reload, 2000 );

        reload();

        return {
            imageData: imageData,
            isSelected: isSelected,
            imageClicked: imageClicked
        }

    } ] );

    app.directive( 'whiteboardsList', [ 'whiteboardService', function ( whiteboardService ) {

        return {
            restrict: 'E',
            templateUrl: './app/whiteboards-list.html',
            controller: function () {

                this.boards = whiteboardService.imageData;

                this.isSelected = function ( name ) {
                    return whiteboardService.isSelected( name );
                };

            },
            controllerAs: 'whiteboards'
        };

    } ] );

    app.directive( 'boardImage', [ 'whiteboardService', function ( whiteboardService ) {
        return {
            restrict: 'E',
            templateUrl: './app/board-image.html',
            controller: function () {

                this.fullscreen = false;

                this.toggleFullscreen = function () {
                    this.fullscreen = !this.fullscreen;
                };

                this.imageClicked = function ( name ) {
                    whiteboardService.imageClicked( name )
                }

            },
            controllerAs: 'board'
        };
    } ] );

})();
