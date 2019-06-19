// Fetch is embedded into the web page, so it can report back things like favorite icon, images, etc

function fetch( ) {
  try {
    var SH = document
      , text = window.RNPayload? String(window.RNPayload.map(function(code){return String.fromCodePoint(code)}).join('')): false
      , parts = (window.RNUrl? window.RNUrl: window.location.href).match(/(http|https):\/\/([^\/]+)(.*)/)
      , isHTTPS = ('' + window.RNUrl).substr(0,6).toLowerCase() == 'https:'
    if(text) {
      SH = document.createElement('html')
      SH.innerHTML = text
    }
    var props = { title : [ 'og:title', 'twitter:title' ]
                , description : [ 'og:description' ]
                , image : [ 'og:image', 'twitter:image', 'twitter:image:src' ]
                , alt : [ 'twitter:image:alt' ]
                , 'site_name' : [ 'og:site_name' ]
                , site : [ 'twitter:site' ]
                , type : [ 'og:type' ]
                }
      , metaPtr = SH.getElementsByTagName('meta')
      , meta = Array.apply( [ ], metaPtr )
                          .reduce(function(result,iter) {
                            function g(a,b) { return iter.getAttribute(a) || iter.getAttribute(b) }
                            var key = g('property', 'name'), value = g('content', 'value')
                            if(!key||!value||!key.length||!value.length) return result
                            for( var k in props )
                              for( var j = 0 ; j < props[k].length; ++ j )
                                if( key === props[k][j] || key === k ) { result[k] = value ; break }
                            return result
                          }
                          , { favicons : Array.apply( [ ], SH.getElementsByTagName('link') )
                                          .reduce(function( result, iter ) {
                                            var rel = iter.getAttribute('rel')
                                            if( ! rel || ! rel.match(/icon/) ) return result
                                            var href = iter.getAttribute('href')
                                            // no relative links allowed
                                            if( href )
                                              if (href.substr(0,2) == '//')
                                                result.push((isHTTPS ? 'https:' : 'http:') + href)
                                              else
                                                result.push( href.match(/^(http|https)/)
                                                                    ? href
                                                                    : parts[1]+'://'+parts[2]+(href[0]=='/'? href: '/'+href)
                                                                  )
                                            return result
                                          }, [ ])
                          })
      , images = Array.apply([ ], SH.getElementsByTagName('img'))
      , metaImages = Array.apply([ ], metaPtr).reduce( (r, it) => {
        let a = it.getAttribute('property'), b = it.getAttribute('name')
          , A = it.getAttribute('content'), B = it.getAttribute('value')
          , types = [ 'og:image', 'twitter:image', 'twitter:image:src' ]
        if( types.indexOf(a) !== -1 || types.indexOf(b) !== -1 )
          r.push(A? A: B)
        return r
      }, [ ])
      , imgList = metaImages.concat(images.reduce((r,it) => { r.push(it.src); return r }, [ ]))
        .map( it => it.match(/^(http|https)/)? it: parts[1]+'://'+parts[2]+(it[0]=='/'? it: '/'+it) )
        .filter( it => it.match(/(jpe?g|png)$/) )

      , message = { meta : meta, images : imgList }
    if(window.RNText) message.url = window.RNText
    if (window.nativePostMessage) window.nativePostMessage(JSON.stringify(message))

  } catch ( err ) {

    if (window.nativePostMessage) window.nativePostMessage(JSON.stringify({ meta : false }))

  }
}










let { width : w, height : h } = Dimensions.get('window')
class PostLinkComponent extends Component {
  constructor(props) {
    super(props)
    this.results = { }
    this.filtered = { }
    this.scanTimes = [ 1000, 2000, 5000, 10000, 22000, 30000, 60000 ]
    this.state = { fetching : false, selectedImageIndex : 0, url : 'about:blank', fetched : 'about:blank', images : [ ], hasScrolled : false }
    this.typing = Date.now( )
    this.realText = ''
    this.realNavUrl = ''
    this.api = DebugConfig.useFixtures ? FixtureAPI : API.create( )
    this.dropdown = new Animated.Value(45)
  }
  componentWillMount ( ) {
    this.subs = [
      this.props.nav.addListener( 'didFocus', ( ) => {this.setState({ focused : true })} )
    , this.props.nav.addListener( 'willBlur', ( ) => {
        this.setState({ focused : false })
        console.log('clearing link post background timers')
        if( this.navStateChange ) {
          this.navStateChange.forEach(clearTimeout)
          this.navStateChange = false
          this.fetched = 'about:blank'
        }
      })
    ]
  }
  componentWillUnmount( ) {
    this.subs.forEach(sub => sub.remove( ))
  }
  componentDidMount( ) { this.api.setAuthorization(this.props.auth.token) }

  textChanged = newText => {
    if( this.typingEvent ) {
      clearTimeout( this.typingEvent )
      this.typingEvent = null
    }
    this.realText = newText
    this.typing = Date.now( )
    this.setState({ fetching : true, fetched : 'about:blank' })
    let after = (start, text) => ( ) => {
      // show loader if we have asset
      var url = text
      // try to rescue non-strict urls
      if( url.match(/^https?:\/\//) ) {
        // no op
      } else if( url.match(/^\/\//) ) url = `http:${url}`
      else url = `http://${url}`
      this.setState({ url : url, images : [ ], selectedImageIndex : 0, hasScrolled : false })

      RNFetchBlob.fetch ( 'GET', url )
      .then( res => {
        this.setState({ fetching : false })
        var  redirects = false
           , status = false
        if(res.info) {
          redirects = res.info( ).redirects
          status = res.info( ).status
        }
        if( status == 200 && Array.isArray(redirects)) { // HTTP OK
          var charList = [ ]
          for( var i = 0; i < res.data.length ; ++ i )
            charList.push( res.data.charCodeAt(i) )
          this.refs.textview.injectJavaScript(`window.RNPayload = [${charList}]; window.RNText = '${url}'; window.RNUrl = '${redirects[redirects.length-1]}'; ${fetch.toString( )}; fetch( );`)
        } else { // in case of the obscure
          Animated.timing( this.dropdown, { toValue : 45, duration : 333 }).start( )
        }
      })
      .catch( error => {
        this.setState({ fetching : false })
        console.log(error)
      })
    }
    this.typingEvent = setTimeout( after(this.typing, newText), 500 )
  }
  webviewNavigate = nav => {
//    console.log(JSON.stringify(nav))
    this.realNavUrl = nav.url

    if(nav.url.match(/^http/)) {
      const stateChange = (url, depth) => ( ) => {
        if(this.refs.webview) {
          console.log(`deep-reading: ${url}, depth: ${depth}`)
          this.refs.webview.injectJavaScript(depth? 'fetch( );': `${fetch.toString( )}; fetch( );`)
        }
      }
      const runScan = (wait, depth) => setTimeout(stateChange(this.state.url, depth), wait)

      if( this.state.fetched !== nav.url ) {
        if( this.navStateChange ) {
          this.navStateChange.forEach(clearTimeout)
          this.navStateChange = false
        }
        this.setState({ fetched : nav.url })
        this.navStateChange = this.scanTimes.map(runScan)
      }
    }
  }
  onErrorWebView = e => {
    // console.log("on error web view e = " + JSON.stringify(e))
  }
  filterResults = async url => {
    let images = this.results[url].images, result = (this.filtered[url]? this.filtered[url].reduce((li,u) => { li[u]=true; return li }, { }): { })
    for( var i = 0; i < images.length; ++i) {
      let { w, h } = await new Promise( (resolve, reject) => {
        Image.getSize(images[i], (w,h) => resolve({ w, h }), e => resolve({ w : 0, h : 0 }))
      })
      if( w < 225 || h < 150 ) continue
      result[images[i]] = true
      this.filtered[url] = Object.keys(result)
      this.setState({ refresh : true })
    }
  }

  onMeta = e => {
    console.log(e.nativeEvent)

    try {
      var obj = JSON.parse(e.nativeEvent.data)
      if( obj.meta ) {
        console.log('got fetch metadata')
        console.log('data object: ', obj)

        if( Object.keys(obj.meta).length > 1 && typeof obj.url === 'string' ) {
          console.log('found valid meta data')
          var uniques = Object.keys(obj.images.reduce((li,u) => { li[u] = true ; return li }, { }))
          this.results[obj.url] = { meta : JSON.parse(JSON.stringify(obj.meta))
                                  , images : JSON.parse(JSON.stringify(uniques))
                                  , startTime : Date.now( ) }
          this.filtered[obj.url] = obj.meta.image? [obj.meta.image]: [ ]
          this.filterResults(obj.url)
          Animated.timing( this.dropdown, { toValue : 270, duration : 333 }).start( )
        } else {
          Animated.timing( this.dropdown, { toValue : 45, duration : 333 }).start( )
        }
      } else {
        Animated.timing( this.dropdown, { toValue : 45, duration : 333 }).start( )
      }
    } catch ( error ) {
      console.warn (error)
      Animated.timing( this.dropdown, { toValue : 45, duration : 333 }).start( )
    }
    this.setState({ refresh : true })
  }
  onMessage = e => {
    console.log(e.nativeEvent)
    try {
      var obj = JSON.parse(e.nativeEvent.data)
      if( obj.meta ) {
        console.log('got deep images')
        const list = (li,u) => { li[u] = true ; return li }
        if( ! this.results[this.state.url] ) {
          if( Object.keys(obj.meta).length > 1 ) {
            console.log('javascript meta')
            this.results[this.state.url] = { meta : JSON.parse(JSON.stringify(obj.meta))
                                           , images : Object.keys(obj.images.reduce(list, { }))
                                           , startTime : Date.now( )
                                           }
            this.filtered[this.state.url] = obj.meta.image? [obj.meta.image]: [ ]
            this.filterResults(this.state.url)
            this.setState({ refresh : true })
            Animated.timing( this.dropdown, { toValue : 270, duration : 333 }).start( )
          }
        } else if( Object.keys(obj.meta).length > 1 && this.results[this.state.url] ) {
          var exp = this.results[this.state.url].images.reduce(list, { })
          exp = obj.images.reduce(list, exp)
          this.results[this.state.url].images = Object.keys(exp)
          this.filterResults(this.state.url)
          this.setState({ refresh : true })
        }
      }
    } catch ( error ) {
      console.warn (error)
    }
  }

  imageSize = async ( url ) => {
    if( ! url ) return Promise.resolve({ h : 1242, w : 2208 })
    let result = await new Promise( (resolve, reject) => {
      Image.getSize(url, (w,h) => resolve({ w : w, h : h }))
    })
    return result
  }
  resizeImage = async ( url, size, display = { width : 1242, height : 1242 }) => {
    let b64 = await new Promise( (resolve, reject) => {
      let minor = size.w > size.h? size.h: size.w
      ImageEditor.cropImage( url
        , { offset : { x : (size.w/2)-(minor/2), y : (size.h/2)-(minor/2) }
          , size : { width : minor, height : minor }
          , displaySize : display
          , resizeMode : 'contain'
          }
        // resolve
        , uri => ImageStore.getBase64ForTag(uri, b64 => resolve(b64), console.warn)
        // reject
        , reject
        )
    })
    return b64
  }
  postLink = async action => {
    const YouTubeLinkType = [ /youtu.be\/([^\/]+)/, /v=([^&]+)/, /\/v\/([^?\/]+)/ ]
    var result = this.results[this.state.url], m = result.meta
      , site = m.site_name
      , isYouTube = site && site === 'YouTube'
      , ytMatch = YouTubeLinkType.map(this.state.url.match.bind(this.state.url)).filter(v=>v)
      , YTID = ytMatch.length? ytMatch[0][1] : false
      , parts = this.state.url.match(/(http|https):\/\/([^\/]+)(.*)/)
    // console.tron.display({name: 'postLink',preview: "result",value: {parts: parts, m: m, result: result}})
    if( ! result.meta.title )
      result.meta.title = result.url
    Object.assign(result.meta, { pasted_url : this.state.url, favicon : m.favicons.length? m.favicons[0]: (parts[1]+'://'+parts[2]+'/favicon.ico') })
    this.setState({ fetching : true })
    Keyboard.dismiss ( )

    let url = this.filtered[this.state.url]&&this.filtered[this.state.url][this.state.selectedImageIndex]? this.filtered[this.state.url][this.state.selectedImageIndex]: 'https://s3.amazonaws.com/kargoe-docs/meta-picture-01.jpg'
      , size = await this.imageSize( url )
      , b64 = await this.resizeImage( url, size )
      , b64Thumb = await this.resizeImage( url, size, { width : 400, height : 400 })
    console.log(`got ${JSON.stringify(size)}`)
    if( action === 'tag' ) {
      this.setState({ fetching : false, url : 'about:blank' })
      this.props.nav.navigate ('editPost', {  data : { Caption : ' '
                                , IsVideo : false, ISell : [ ], TheySell : [ ], UserTags : [ ]
                                , LocationCoord : '', LocationName : '', LocationId : ''
                                , MediaType : 'JPEG', AspectRatio : 1
                                , Type : isYouTube ? 2 : 1 // YouTube -> 2, LinkPost -> 1
                                , MiniMeta : isYouTube ? YTID : false // YouTube -> VideoId
                                , Meta : result.meta
                                , UserId : this.props.auth.user.UserId
                                , b64 : b64, thumb : b64Thumb
                                }
                        , postType : 'LINK'
                        })
    } else {
      this.api.createPost({
        Caption : ' '
      , IsVideo : false, ISell : [ ], TheySell : [ ], UserTags : [ ]
      , LocationCoord : '', LocationName : '', LocationId : ''
      , MediaType : 'JPEG', AspectRatio : 1
      , Type : isYouTube ? 2 : 1 // YouTube -> 2, LinkPost -> 1
      , MiniMeta : isYouTube ? YTID : false // YouTube -> VideoId
      , Meta : result.meta
      }).then( resp => {
        let post = resp.data.data[0]
        const { PostId, bucket, image, thumbImage } = post
        // upload image to s3
        let headers = { 'Content-Type' : 'application/octet-stream' }
        RNFetchBlob.fetch ( 'PUT', image._url, headers, b64 )
        .then( ( ) => {RNFetchBlob.fetch ( 'PUT', thumbImage._url, headers, b64Thumb )} )
        .then( ( ) => {
          this.api.completePost ( PostId ).then(( ) => {
            // refresh the wall once we know the post is made
            this.props.onRefresh( )
          }).catch(console.log)
        })
      }).catch((e) => {
        this.refs.postlinkinput.wrappedInstance.clear( )
        this.setState({ fetching : false, url : 'about:blank' })
        Animated.timing( this.dropdown, { toValue : 45, duration : 333 }).start( )
        console.log(e)
      })
      // immediately after calling create post asynchronously
      this.refs.postlinkinput.wrappedInstance.clear( ) // clear the text box
      this.setState({ fetching : false, url : 'about:blank' }) // set the dropdown state
      Animated.timing( this.dropdown, { toValue : 45, duration : 333 }).start( ) // animate the dropdown closed
    }
  }

  carouselImage = (url, index) =>
    <TouchableOpacity style={{ margin : 2, padding : 1, height : w*0.315+8, width : w*0.315+8, borderWidth : this.state.selectedImageIndex===index?3:0, borderColor : 'black' }} onPress={( ) => this.setState({ selectedImageIndex : index})}>
        <Image source={{ uri: url }} resizeMode='cover' style={{ width : w*0.315, height : w*0.315 }} />
    </TouchableOpacity>
  extraData = valid => valid
  ? <View style={{ width : '100%' }}>
      <Text style={{ margin : 5, marginLeft : 15, fontSize : 12, fontFamily: Fonts.style.font.bold }} numberOfLines={2}>{this.results[this.state.url].meta.title
            ? this.results[this.state.url].meta.title
            : this.results[this.state.url].url}
      </Text>
      <Text style={{ marginLeft : 15, fontSize : 12, fontFamily: Fonts.style.font.bold }}>Choose Cover Image: </Text>
      <ScrollView horizontal={true} onScroll={( ) => this.setState({ hasScrolled : true })}>
        {this.filtered[this.state.url] && this.filtered[this.state.url].map(this.carouselImage)}
        {this.results[this.state.url] && (Date.now( ) - this.results[this.state.url].startTime) < 20000 &&

           <View style={{ minWidth: w*0.315, minHeight: w*0.315, maxWidth: w*0.315, maxHeight: w*0.315, justifyContent : 'center', alignItems : 'center' }}>
             <LottieView style={{ minWidth: w*0.1825, minHeight: w*0.1825, maxWidth: w*0.1825, maxHeight: w*0.1825, marginLeft : -20, marginTop : -30 }}
              ref={ spinner => {
                if(spinner) {
                  this.refs.spinner = spinner
                  spinner.play( )
                }
              }}
              loop autoPlay
              source={Images.spinnerDark}
             />
           </View>

        }
      </ScrollView>
      {this.filtered[this.state.url] && this.filtered[this.state.url].length > 3 && !this.state.hasScrolled &&
        <Image source={Images.postlinkScrollIndicator} resizeMode='contain' style={{ position : 'absolute', bottom : w*0.1575+70, right : 0, zIndex : 2, width : 45, height : 45 }} />
      }
      <View style={{ width : '100%', height : 70, flexDirection : 'row', alignItems : 'flex-start', justifyContent : 'center' }}>
        <TouchableHighlight onPress={this.postLink.bind(this,'tag')} style={{ marginRight : 25 }}>
            <Image source={Images.postlinkAddTag} resizeMode='contain' style={{ width : 100, height : 35 }}/>
        </TouchableHighlight>
        <TouchableHighlight onPress={this.postLink.bind(this,'post')}>
            <Image source={Images.postlinkPost} resizeMode='contain' style={{ width : 100, height : 35 }}/>
        </TouchableHighlight>
      </View>
    </View>
  : null
  render ( ) {
    console.tron.log(`PostLinkComponent statusAndNavHeight: ${statusAndNavHeight}`)
    var iconContainer = { marginRight : 5, height: 35, width: 35
                        , borderColor: '#8692b7'
                        , borderWidth: 1
                        , justifyContent: 'center'
                        , alignItems: 'center'
                        }
      , iconBorder = { width: 30, height: 30 }
    const { toogleGridView, viewMode }  = this.props
    var validPostLinkMeta = this.results[this.state.url]
      , showExtra = !this.state.fetching && validPostLinkMeta
    // console.log(`would show meta data: ${showExtra? 'true': 'false'}`)
    // if(showExtra) console.log(validPostLinkMeta.images) // print image list _every_ render

    const modeIcon = viewMode == 'grid' ? Images.gridProfile : viewMode == 'list' ? Images.listProfile : Images.mosaicProfile
    // position: 'absolute', top: statusAndNavHeight
    return (
      <View style={{}}>
        <Animated.View style={{ width : '100%', marginTop : 10, height : this.dropdown, flexDirection : 'row', paddingBottom : 10, flexWrap : 'wrap', alignItems : 'flex-start' }}>
          <View style={{ marginLeft : 10, width : w-50, height : 35, flexDirection : 'row', alignItems : 'center', justifyContent : 'flex-start' }}>
            <Input style={{ paddingLeft: 10, margin: 5,
                height: 35,
                borderColor: 'black', borderRadius: 10, borderWidth: 1,
                fontSize: 11, fontFamily: Fonts.style.font.regular,
                lineHeight : 35 }}
              ref = {'postlinkinput'}
              autoCapitalize='none' autoCorrect={false}
              placeholderTextColor = 'grey'
              placeholder='Post a link from your favorite source!'
              onChangeText={this.textChanged}>
            </Input>
            { this.state.fetching
              ? (<Image style={{ height : 30, flex : 0.3 }} resizeMode='contain' source={Images.splashLogo} />)
              : (<Text></Text>)
            }
          </View>
          <View style={iconContainer}>
            <TouchableHighlight onPress={toogleGridView} underlayColor='grey'>
              <Image source={modeIcon} style={iconBorder} />
            </TouchableHighlight>
          </View>
          {this.extraData(showExtra)}
          <View style={{ width : 1, height : 1, position : 'absolute', display : 'none' }}>
            <WebView
              ref={'webview'}
              source={{ uri : this.state.url }}
              style={{ width : 1, height : 1, opacity : 0 }}
              javaScriptEnabled={true}
              startInLoadingState={true}
              mixedContentMode={'compatibility'}
              allowUniversalAccessFromFileURLs={true}
              onMessage={this.onMessage}
              onError={this.onErrorWebView}
              onNavigationStateChange={this.webviewNavigate}
            />
            <WebView
              ref={'textview'}
              source={{ uri : 'about:blank' }}
              style={{ width : 1, height : 1, opacity : 0 }}
              javaScriptEnabled={true}
              startInLoadingState={true}
              mixedContentMode={'compatibility'}
              allowUniversalAccessFromFileURLs={true}
              onMessage={this.onMeta}
              onError={this.onErrorWebView}
            />
          </View>
        </Animated.View>
      </View>
    )
  }
}




// The react webview must be patched due to issues with namespace collision
// postMessage -> nativePostMessage
- (void)webViewDidFinishLoad:(UIWebView *)webView
{
    printf("webViewDidFinishLoad\n");
    NSString *source = [NSString stringWithFormat:
      @"(function() {"
        "var messageQueue = [];"
        "var messagePending = false;"

        "function processQueue() {"
          "if (!messageQueue.length || messagePending) return;"
          "messagePending = true;"
          "window.location = '%@://%@?' + encodeURIComponent(messageQueue.shift());"
        "}"

        "window.nativePostMessage = function(data) {"
          "messageQueue.push(String(data));"
          "processQueue();"
        "};"

        "document.addEventListener('message:received', function(e) {"
          "messagePending = false;"
          "processQueue();"
        "});"
      "})();", RCTJSNavigationScheme, kPostMessageHost
    ];
    [webView stringByEvaluatingJavaScriptFromString:source];

  if (_injectedJavaScript != nil) {
    NSString *jsEvaluationValue = [webView stringByEvaluatingJavaScriptFromString:_injectedJavaScript];

    NSMutableDictionary<NSString *, id> *event = [self baseEvent];
    event[@"jsEvaluationValue"] = jsEvaluationValue;

    _onLoadingFinish(event);
  }
  // we only need the final 'finishLoad' call so only fire the event when we're actually done loading.
  else if (_onLoadingFinish && !webView.loading && ![webView.request.URL.absoluteString isEqualToString:@"about:blank"]) {
    _onLoadingFinish([self baseEvent]);
  }
}
