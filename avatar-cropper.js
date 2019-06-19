export default class ImageCrop extends Component {
  constructor(props) {
    let { width, height } = Dimensions.get('window')
    super(props)
    this.state = {
      w : width, h : height
    , b64 : this.props.image || false
    , touching : false, d : { x : 0, y : 0 }
    , blitSource : this.contain({ width : width, height : height }, this.props.image)
    , offset : { x : 0, y : 0 }
    , scale : (2/3)
    }
    this.error = false
    if( !props.width && !props.height ) {
      this.error = `please specify <ImageCrop width={300} height={150} />`
    }
    this.offset = [0,0]
    let off=this.offset
    const upOff=g=>this.offset=[off[0]+g.dx,off[1]+g.dy]

    this.length = false
    this.numTouches = 0
    this._panResponder = PanResponder.create({
        onStartShouldSetPanResponder : (evt,gest) => true
      , onStartShouldSetPanResponderCapture: (evt,gest) => true
      , onMoveShouldSetPanResponder : (evt,gest) => true
      , onMoveShouldSetPanResponderCapture : (evt,gest) => true
      , onPanResponderGrant : (evt,gest) => {
        this.setState({ touching : true })
        upOff(gest)
      }
      , onPanResponderMove : (evt,gest) => {
        this.setState({ touching : true })
        let t = evt.nativeEvent.touches
        if( ! this.touches ) this.touches = t
        if( this.numTouches != t.length ) {
          this.numTouches = t.length // finger gained or lost, skip deltas
        } else if( t && t.length ) {
          // find the center point
          let sumXY = t.reduce( (c, touch) => {
            c.x += touch.pageX
            c.y += touch.pageY
            return c
          }, { x : 0, y : 0 } )
          , center = { x : sumXY.x/t.length, y : sumXY.y/t.length }
          // sum the edges into one length
          , length = (t.reduce( (d, touch) => { return d + (Math.abs(touch.pageX-center.x)) + (Math.abs(touch.pageY-center.y)) }, 0 ) / t.length)
          if( length && this.length && length > 1 && this.length > 1 ) {
            let newScale = this.state.scale * (length/this.length)
            if( newScale > 1 ) newScale = 1
            if( newScale < 0.1 ) newScale = 0.1
            this.setState({ scale : newScale })
          }
          this.length = length
          this.numTouches = t.length
        }
        upOff(gest)
      }
      , onPanResponerTerminationRequest : (evt,gest) => false
      , onResponderTerminationRequest : (evt,gest) => false
      , onPanResponderRelease : (evt,gest) => {
        var oX = this.state.offset.x+this.offset[0], oY = this.state.offset.y+this.offset[1]
        this.setState({ touching : false, offset : { x : oX, y : oY } })
        this.offset = [0,0]
        if( this.props.onSelectionChange )
          this.props.onSelectionChange( { x : oX / this.state.blitSource.w, y : oY / this.state.blitSource.h }, this.state.scale )
      }
      , onPanResponderTerminate : (evt,gest) => {
        this.setState({ touching : false, int : true })
        this.offset = [0,0]
      }
      , onShouldBlockNativeResponder : (evt,gest) => true
    })
  }
  contain = (a, b) => { // b in a
    let vec2 = [ a.width, a.height, b.width, b.height ]
      , ar = [ a.width / a.height, b.width / b.height ]
    var mode = ar[1] > ar[0]? 0: (ar[1] < ar[0]? 1: 2) // 0 -> image is wide, 1 -> image is tall, 2 -> square
      , dest = { x : 0, y : 0, w : 0, h : 0 }
    switch(mode) {
      case 0:
        dest = { w : vec2[0], h : vec2[0] / ar[1]
               , x : 0 }
        dest.y = (vec2[1]/2) - ( dest.h / 2)
        break
      case 1:
      default:
        dest = { h : vec2[1], w : vec2[1] * ar[1]
               , y : 0 }
        dest.x = (vec2[0]/2) - ( dest.w / 2 )
        break
    }
    return dest
  }
  render ( ) {
    let { width : w, height : h } = this.props
        , sQ = w<h?w:h, scale = this.state.scale, sO = (1-scale)*sQ/2
        , drag = { x : this.state.offset.x+this.offset[0], y : this.state.offset.y+this.offset[1] }
    return (
      <View style={{ width: w, height: h }}>
        <Image source={{ uri : this.props.image.uri }} style={{ width: w, height : h, position: 'absolute', top : 0, left: 0 }} />
        <View style={{ backgroundColor : '#00000088', position: 'absolute', left: 0, top: 0, width: w, height : h }}></View>
        <Animated.View {...this._panResponder.panHandlers}
          style={{ width : sQ*scale, height : sQ*scale, position: 'absolute', left: drag.x + sO, top: drag.y + sO, borderRadius : sQ/2, overflow: 'hidden' }}>
          <Animated.Image source={{ uri : this.props.image.uri }}
            style={{ width : w, height : h
                  , position: 'absolute', left : drag.x*-1 -sO, top : drag.y*-1 -sO }}
            resizeMode='' />
        </Animated.View>
      </View>
    )
  }
}

