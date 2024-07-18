# Motivations

Obligatory XKCD

![xkcd](https://imgs.xkcd.com/comics/standards_2x.png)

To give some context I've been hard at work with my own [render engine](https://github.com/Open-S2/s2maps-gpu), and I want to ensure that I am properly designing it to be flexible towards more modern use cases and tooling as I believe adoption is going to be a slow and painful process. Technology is always evolving and I feel like GIS especially is moving into a new more exciting phase and I want to properly prepare for it but also just be a part of it. It's obviously really difficult to know how to prepare and design for the future, but I hope this article serves as a decent lens into my own research and conclusions into how the data layers/protocols should be handled.

I want to be clear that my thoughts here are my own opinion and I'm arguably in direct "competition" with Maplibre on what the next vector spec should look like. So take everything I say with a little bit of salt.

Also, I just never have enough time for these things, so I apologize for what's probably a grammar and spelling nightmare. I tried.

## The Starting Point

Ten years ago, Mapbox showcased their [vector tile specification](https://github.com/mapbox/vector-tile-spec). This spec was designed to compliment their [webgl rendering engine](https://github.com/mapbox/mapbox-gl-js). Something I really respect about what Mapbox has done is their ability to create so many tools that have stood the test of time while simultaneously maintaing simplicity. Other tools they pioneered are [kdbush](https://github.com/mourner/kdbush), [earcut](https://github.com/mapbox/earcut) and [geojson-vt](https://github.com/mapbox/geojson-vt). All highly performant, simple, and well implemented solutions for vector data.

## My Take on the Weaknesses of the Mapbox Vector Tile Spec

While an incredibly well designed spec, I found some weaknesses that I addressed in my first iteration. I originally labeled the project [s2-vector-tile](https://www.npmjs.com/package/s2-vector-tile?activeTab=versions) and actually created that version 5 years ago. When studying the performance shortcomings I found there were really only two components that effected speed of use from decompression to rendering.

The first was how polygons were encoded. The spec simplifies polygons by flattening them down to a series of lines. This is problematic with multi-polygons especially. To decompress and categorize outer and inner rings, you have to literally [evaluate every single point](https://github.com/mapbox/vector-tile-js/blob/af16ca5b3c2dcba181338bc9a1cdb56443d43105/index.js#L235) in each line to determine its rotation. This is incredibly inefficient, and was actually entirely avoidable. The spec uses [command codes](https://github.com/mapbox/vector-tile-spec/blob/5330dfc6ba2d5f8c8278c2c4f56fff2c7dee1dbd/2.1/README.md?plain=1#L105) to know how to move the cursor around and how to move to the next line. While the command codes must fit inside 3 bits, some values where NEVER USED! This means they could have always added a `close polygon` command code for free (which coincidentally was my solution at the time to completely remove this problem).

The second problem is a bit more advanced and the connection wasn't even noticed besides me until several years later by [Ivan Sanchez](https://github.com/nyurik/future-mvt/discussions/1#discussioncomment-4180872) at Maplibre. To render vector polygons to the screen via GPU, you have to do a lot of [computing](https://github.com/mapbox/earcut) effort to break up the polygon into triangles. This is an incredibly slow process relative to everything else. The idea then is, why not include the indices that correspond to the vertices in the triangles? While obviously this adds some overhead in tile size cost, the performance difference is remarkable and worth persuing as an optional feature.

## Current Direction of the Open Vector Tile Ecosystem

In 2018, Mapbox attempted to iterate a [third time](https://github.com/mapbox/vector-tile-spec/projects/1) with their spec to be more feature rich. It's interesting to note they were considering [columner encoding](https://github.com/mapbox/vector-tile-spec/issues/105) albeit limited in scope all the way back then. There were other issues that addressed roughly the same concept [time](https://github.com/mapbox/vector-tile-spec/issues/35) and [time](https://github.com/mapbox/vector-tile-spec/issues/44) again. I think it's important to address this because it seems like column encoding is going to be a common theme even outside GIS use cases as a storage mechanic.

As far as I am aware, Mapbox dropped their attempt at their next iteration.

On November 18, 2022 [Yuri Astrakhan](https://github.com/nyurik) started a [discussion panel](https://github.com/nyurik/future-mvt/discussions/1) on what a new tile spec could look like via Maplibre's direction and guidance. Markus Tremmel took the idea and ran with a proof of concept that now is available for testing called the [Maplibre Tile Spec](https://github.com/maplibre/maplibre-tile-spec).

Early 2024 I decided to make one more iteration myself after assessing these discussions and talking to [Markus Tremmel](https://github.com/mactrem) and [Yuri](https://github.com/nyurik). This project is the result of my own ideas and research.

## The Fundamental Concept of Vector Tiles (Geometry & Attributes)

Bar none, this part is so crucial to understand. I think in vector GIS data, it's so easy to miss the forest for the trees, but fundamentally the concept is actually quite simple. Vector tile data comprises of only two major components: geometry and attributes. We bundle that concept into what we call a **feature**, and in every tile spec so far features are further grouped/categorized into **layers**.

The geometry is stored as `i32` values mapped to a square of `extent` (a power of 2 size) and does not by itself represent a projection, that is left up to the user to know prior to decoding for use. This is a powerful concept since even the S2 spherical projection can still take advantage of it.

Interestingly almost every modern GIS spec has somewhat agreed that almost all vector geometry can be successfully conveyed in 3 components: **points**, **lines**, and **polygons**. Yeah, geniunely think about that. 3 geometric structures can represent all data necessary to render a map. Although, you could technically say it's 6 these days to add the third dimension.

## The Missing Pieces

My personal argument is that one of the biggest reasons to update the vector spec is to add more features. So what ideas could we add to make it more feature rich? I propose the following:

* Upgrade the codebase to match modern standards: proper module treeshake with Typescript support/safety.
* Store Pre-Tessellated & Indexed polygon geometries to quickly ship data to the renderer. Yes, this has a slightly higher storage cost but much better performance from decoding to rendering.
* Support for 3D geometries. While I don't personally see many use cases for this, I think it's important to support it for corner cases as the code and complexity cost stays relatively low. However, the addition should stay minimalistic and true 3D support should be left to other specifications.
* Support for M-Values for each geometry point (used by multi-points, lines, and polygons).
* Column encoding of data to make it more compact. This allows better gzip and brotli compression.
* Support nested objects in properties and m-values. Allow more complex objects in properties and m-values.
* All features should support first class citizen `BBOX` (bounding box) data like IDs. This is a massive improvement for understanding data that exceeds the tile itself. Want to know how big a polygon or line is that stretches outside the tile? Want to zoom out to see a collection of points that exist across tiles? Now you can. Much like IDs, by having this concept exist it incentivizes the tools in the production lines that create tiles to support it.
* Lines `offsets` support to know the distance it's traveled. This is useful for correctly rendering dashed lines across tiles for instance. Currently, everytime a dashed line crosses a tile, it just resets the offset to 0 and the dashes don't line up.
* More convenience functions to make it easier to access and utilze the data for processing. What if you want to convert a collection of lines into a set of points. What if you want polygons to be lines with offsets. These tasks should be managed by the module itself, not the renderer. That way the renderer can focus on it's own job without code bloat or accidental misuse.
* Feature Properties & M-Values are stored as "Shapes" which reuses objects only needing to do lookups on values. Something interesting about storing vector data is that for each layer, the shape of the data is consistent and the same across all features of the same type. We can capitalize on this and improve compression by specifying the shape of the data prior to storage. An example of how this works is the [Open Map Tiles Schema](https://openmaptiles.org/schema/). This is the norm in vector data, the properties are predefined in their shape. Meanwhile m-values operate in a similar way, that all m-values for a specific gemoetry set have the same shape.

To summerize, tiles themselves only tell a partial story about map, so some mechanics should be added to help better understand the story outside the tile bounds. Other features should be added to allow more customization and flexibility in data.

## Comparing The Specifications

Now on to the uncomfortable section. Keep in mind these are just my own personal thoughts and opinions. However, this section is really the most important because I think it opens up a discussion on what say 5 years from now the best spec could be and things I learned in the process of creating my own tool and analyzing each spec.

What I value most is simplicity and performance. Those two concepts can be seen as constantly at odds with each other, and yet I believe the fight to fuse them together is one of the most important methods to achieving code that stands the test of time.

I'm also writing this at a lucky moment where The Maplibre Tile Spec is now in a live [testing phase](https://mltdemo.stamen.com/). This means I can provide real metrics to compare against. This comes with an important caveat that it's still a work in progress specification and not all the performance enhancing features are fully implemented.

One thing I love about the project is the number of experiments Markus has been able to achieve. There are some really cool and fun tests like checking the value of using SIMD and various compression techniques.

However, here are my takes so far on three key topics:

### Compression

I would argue this is one of the biggest components (or at least the most worked on) for the Maplibre Tile Spec. Ideally, if the final tile size is much smaller then its predicessor, it gives more breathing room for more data, but also ensures faster shipment of said data, less cost for storing tiles, etc.

I created some [basic benchmarking](https://github.com/Open-S2/open-vector-tile/tree/master/benchmarks) tests to better understand the story of compression. Maplibre touts "`up to 6x better compression`" which is actually an incredible feat. But lets dive a little deeper.

Testing the OpenMapTiles data, we do see fantastic compression at face value:

> NOTE:
> COVT was the old name for the spec, that's why you see it over mlt.

```raw
RAW:

| zoom |       mvt |      covt |       ovt |
| :--- | --------: | --------: | --------: |
| 2    | 564.99 kB | 302.85 kB | 392.73 kB |
| 3    | 385.14 kB | 261.98 kB | 269.50 kB |
| 4    | 942.42 kB | 226.45 kB | 741.16 kB |
| 5    | 817.49 kB | 189.61 kB | 581.62 kB |
| 6    | 588.45 kB | 156.18 kB | 424.84 kB |
| 7    | 524.11 kB | 154.58 kB | 376.94 kB |
| 8    | 421.56 kB | 115.47 kB | 296.48 kB |
| 9    | 298.35 kB |  97.19 kB | 309.43 kB |
| 10   | 150.17 kB |  59.64 kB | 148.41 kB |
| 11   |  93.95 kB |  38.03 kB |  92.13 kB |
| 12   | 165.01 kB |  59.31 kB | 138.77 kB |
| 13   |  93.35 kB |  47.59 kB |  86.77 kB |
| 14   | 627.96 kB | 310.42 kB | 641.71 kB |
| all  | 348.00 kB | 121.23 kB | 292.99 kB |
```

It's actually really impressive. Looking at zoom 9 especially the average compression is fantastic.

However, and this is the most important component to understand, even with Maplibre's compression, you still see a huge improvement on compression using gzip or brotli. In other words, you shouldn't ship even Maplibre's data without compressing first.

Now-a-days all major online data storage services help ship compressed data for you. S3 should be covered by Cloudfront. R2 should be covered by Cloudflare's CDN system. No matter what I'd argue the industry standard is to compress your data before caching and shipping it. Ontop of this, brotli compression has become the norm with almost [complete support](https://caniuse.com/brotli).

So when we dive a bit deeper into this topic, we can see the true impact of compression on the Maplibre Tile Spec:

```raw
GZIP:

| zoom |       mvt |      covt |       ovt |
| :--- | --------: | --------: | --------: |
| 2    | 310.33 kB | 180.64 kB | 207.47 kB |
| 3    | 232.92 kB | 145.79 kB | 149.74 kB |
| 4    | 357.16 kB | 169.22 kB | 340.76 kB |
| 5    | 318.29 kB | 135.08 kB | 286.55 kB |
| 6    | 235.23 kB | 119.64 kB | 200.60 kB |
| 7    | 218.99 kB | 106.73 kB | 176.72 kB |
| 8    | 171.41 kB |  86.24 kB | 139.57 kB |
| 9    | 147.17 kB |  81.13 kB | 161.32 kB |
| 10   |  82.36 kB |  50.76 kB |  88.08 kB |
| 11   |  53.02 kB |  31.95 kB |  57.34 kB |
| 12   |  80.18 kB |  50.33 kB |  86.07 kB |
| 13   |  55.38 kB |  41.43 kB |  60.15 kB |
| 14   | 346.24 kB | 233.59 kB | 322.94 kB |
| all  | 162.40 kB |  92.03 kB | 150.69 kB |

BROTLI:

| zoom |       mvt |      covt |       ovt |
| :--- | --------: | --------: | --------: |
| 2    | 165.15 kB | 162.54 kB | 172.33 kB |
| 3    | 128.56 kB | 119.23 kB | 127.03 kB |
| 4    | 189.59 kB | 155.75 kB | 189.04 kB |
| 5    | 149.38 kB | 113.93 kB | 145.68 kB |
| 6    | 119.55 kB | 110.58 kB | 120.77 kB |
| 7    | 112.47 kB |  92.03 kB | 113.11 kB |
| 8    |  89.51 kB |  72.89 kB |  89.43 kB |
| 9    | 124.31 kB |  75.95 kB | 122.79 kB |
| 10   |  70.74 kB |  47.94 kB |  67.74 kB |
| 11   |  45.58 kB |  30.03 kB |  43.22 kB |
| 12   |  70.61 kB |  47.95 kB |  65.70 kB |
| 13   |  50.47 kB |  39.23 kB |  48.18 kB |
| 14   | 289.42 kB | 217.45 kB | 266.77 kB |
| all  | 111.25 kB |  83.81 kB | 107.23 kB |
```

As you can see, MLT tiles raw vs compressed still sees a massive swing. In other words, you SHOULD still ship MLT data compressed before shipping it since you can see more than a 40% reduction in size. Now, gzip still has a recognziable lead compared to other specs, but post brotli compression, they ALL end up pretty similar. emphasis on all because it really shows the testiment of the first Mapbox spec... it's arguably still in the running!

If we actually look at the differences between OVT and MLT for brotli:

```raw
| zoom |     diff |
| :--- | -------: |
| 2    |  9.79 kB |
| 3    |  7.80 kB |
| 4    | 33.29 kB |
| 5    | 31.75 kB |
| 6    | 10.19 kB |
| 7    | 21.09 kB |
| 8    | 16.54 kB |
| 9    | 46.84 kB |
| 10   | 19.81 kB |
| 11   | 13.19 kB |
| 12   | 17.75 kB |
| 13   |  8.95 kB |
| 14   | 49.33 kB |
| all  | 23.42 kB |
```

the largest difference is 49.33 kB but an average of 23.42 kB. What makes this benchmark even more interesting is on smaller datasets like Amazons:

```raw
RAW:

| zoom |       mvt |      covt |       ovt |
| :--- | --------: | --------: | --------: |
| 5    | 378.77 kB | 173.80 kB | 283.90 kB |
| 6    | 292.65 kB | 194.57 kB | 244.62 kB |
| 7    | 117.10 kB |  96.13 kB | 104.83 kB |
| 8    |  82.60 kB |  69.54 kB |  75.78 kB |
| 9    | 168.14 kB | 132.05 kB | 153.71 kB |
| 10   | 104.81 kB |  87.94 kB |  97.73 kB |
| 11   |  81.41 kB |  66.38 kB |  82.99 kB |
| all  | 241.31 kB | 139.67 kB | 194.53 kB |

GZIP:

| zoom |       mvt |      covt |       ovt |
| :--- | --------: | --------: | --------: |
| 5    | 163.99 kB | 133.58 kB | 142.02 kB |
| 6    | 148.09 kB | 162.84 kB | 143.80 kB |
| 7    |  64.48 kB |  75.50 kB |  67.25 kB |
| 8    |  46.46 kB |  52.22 kB |  46.65 kB |
| 9    |  89.57 kB | 104.20 kB |  92.32 kB |
| 10   |  61.40 kB |  68.96 kB |  62.16 kB |
| 11   |  51.50 kB |  52.54 kB |  53.36 kB |
| all  | 115.05 kB | 110.31 kB | 107.04 kB |

BROTLI:

| zoom |       mvt |      covt |       ovt |
| :--- | --------: | --------: | --------: |
| 5    | 133.18 kB | 118.94 kB | 119.26 kB |
| 6    | 128.96 kB | 148.96 kB | 121.97 kB |
| 7    |  59.18 kB |  70.04 kB |  57.11 kB |
| 8    |  43.01 kB |  46.30 kB |  39.64 kB |
| 9    |  82.60 kB |  94.43 kB |  78.96 kB |
| 10   |  57.25 kB |  62.30 kB |  53.41 kB |
| 11   |  48.53 kB |  47.34 kB |  45.03 kB |
| all  |  98.29 kB |  99.46 kB |  90.47 kB |
```

The crazy thing is OVT isn't even designed to make the most out of converting MVT to OVT, and yet when we compare brotli OVT vs MLT, we actually see OVT is usually lighter!:

```raw
| zoom |      diff |
| :--- | --------: |
| 5    |   0.33 kB |
| 6    | -27.00 kB |
| 7    | -12.93 kB |
| 8    |  -6.66 kB |
| 9    | -15.47 kB |
| 10   |  -8.88 kB |
| 11   |  -2.31 kB |
| all  |  -8.99 kB |
```

My hypothesis when I started this project was that we can leave the heavy lifting of compression to external tools, migrate to a column based approach, and then let the server/browser do the heavy lifting of compressing/decompressing files.

I'd argue my hypothesis is correct. We will go deeper later in how it has simplified the codebase, but at face value I think it's worth noting that solving compression at the spec level may not be worth the effort, or at least it's still a work in progress that needs more research.

### Performance

Yet another interesting topic. I found on the `maplibre-tile-format` slack channel meeting notes that claim "`10X+ performance to decode MVTs vs MLTs to in-memory representation`". This is an incredible feat but I'm left wodering where this 10x is coming from. I want to be clear as I've explained prior, that outside pre-earclipping polygon geometry, I don't think any spec has a performance problem. To demonstrate my thoughts on this subject, luckily the MLT tests are live and you [can check the performance yourself](https://mltdemo.stamen.com/). I want to compare to locally running the OVT spec and showcase what a decompression roughly looks like:

> NOTE:
> I will be using a chromium based browser on an M3 Macbook Pro for this. Not convinced we would see much difference with any other browser.

I want to note that I think performance metrics can and will always be gamed. I feel like the best way to measure performance is to just see how it works in real world scenarios. So my goal is to full screen both maps, wait for a full rendering, then check the performance of loading new tiles as we are zooming in and showcase the **average** performance, not worst or best case scenerios. Since the data isn't 1-to-1 there is nothing entirely fair about comparing these two, but I think it helps shed light on what an average rending experience would look like to form more meaningful hypotheses.

I really struggled to get the test website to load lots of MLT tiles for me. But regardless, what was most import is to checkout lower zoom tiles where there is a lot more polygon data. You will notice right away that getting the data out of the spec isn't too time intensive, but that the cost of converting polygons to triangles is:

![mlt-tile-performance](https://github.com/Open-S2/open-vector-tile/blob/master/assets/mlt-tile.png?raw=true)

Just rendering polygons and line data, MLT takes 35ms to prepare the data to ship to the renderer. However, decoding the data out of the tile is 9ms:

![mlt-decode-performance](https://github.com/Open-S2/open-vector-tile/blob/master/assets/mlt-decode.png?raw=true)

It's important to take a second to note that MLT currently [mirrors the shape of the old spec](https://github.com/maplibre/maplibre-tile-spec/tree/main/js/src/mlt-vector-tile-js) to test and doesn't utilize all the claimed performance benefits of the new spec.

Now the OVT spec already utilizes pre-earcut polygons. Keep in mind that I am rendering way more polygons, lines, glyphs, etc. in this test and yet the performance wins with less than half the cost:

![ovt-tile-performance](https://github.com/Open-S2/open-vector-tile/blob/master/assets/ovt-tile.png?raw=true)

We also see that decoding the data out of the tile is suprisingly cheaper as well with 2.71ms:

![ovt-decode-performance](https://github.com/Open-S2/open-vector-tile/blob/master/assets/ovt-decode.png?raw=true)

I'd argue that the decoding solution is very similar to MVT, no tricks or coding solutions outside column encoding fused with protobuffers were used to achieve these results.

You can see that not having to earclip the polygons is a monsterous win. But also, I would argue overall complexity to decode data from protobuffers has never really been a performance issue to begin with. I'm still at a loss where this 10x performance is coming from? Maybe it's refering to tests done with poly indices already stored? But even comparing my solution with indices added, I still don't get 10x performance, so maybe there is some feature not being utilized. I'm definitely skeptical for now though.

Was performance an issue with MVT? My argument is that outside their technique for storing polygons (as explained near the beginning of this article), there were no meaningful performance issues.

So my final thoughts are that vector specs in general don't have a performance problem, none of the three specs suffer from this.

### Simplicity/Complexity of both the Codebase & Output Size

Now this topic is hard to describe when considering the entire scope. Remember that these specs exist as a tool to ship data for the most part to be rendered/displayed. What benefits do we get from each spec? Should we focus on shipment size? How much do we prioritize the benefits for the renderer? How many features are too many? Are we not considering features that we could benefit from down the road? At what point do we cross the threshold into too much complexity and feature bloat outweighing the benefits?

It's always hard to know the right answers but I can definitely try to simplify and share some low-hanging data points with opinions.

One thing we can do easily is look at Mapbox's original spec as a baseline to compare against. The client tool used by their rendering engine is [`7.26 kB` (`2.36 kB` gzip compressed)](https://bundlejs.com/?q=%40mapbox%2Fvector-tile&treeshake=%5B%7B+VectorTile+%7D%5D). It offers extremely basic parsing support leaving the rest for the renderer. Again, I'm absolutely blown away with how well Mapbox can achieve long lasting results for so little.

Moving to malibre's current spec implementation, the results are [`174 kB` (`41.1 kB` gzip compressed)](https://bundlejs.com/?q=%40maplibre%2Fmaplibre-tile-spec&treeshake=%5B%7B+MltDecoder%2CTileSetMetadata+%7D%5D). Keep in mind that this does not include backwards compatibility for the old spec. It's also important to mention that the long term solution of parsing and utilizing the data from the spec won't match with the old spec either. This means the renderer will also become more bloated and complex as well to manage multiple specs. To give some perspective on this new size, this is a `23.966x` increase in size! Also note that the maplibre render engine itself at the time of writing is [`794 kB` (`216 kB` gzip compressed)](https://bundlejs.com/?q=maplibre-gl&treeshake=%5B*%5D). The data management tool manages to be `21.91%` the size of the entire rendering engine. The discussion is to eventually move to a rust solution for the module. Wouldn't then the size cost going to get even worse? Are we expected to see much of a performance improvement either?

Lastly the OVT spec I have released is [`27 kB` (`7.8 kB` gzip compressed)](https://bundlejs.com/?q=open-vector-tile&treeshake=%5B%7B+VectorTile+%7D%5D). This is a `3.72x` increase in size. This includes backwards compatibility for the old spec. This spec also adds more convenience functions for the renderer including `loadPoints`, `loadLines`, and `loadGeometry`, `loadGeometryFlat`, `readIndices` and `addTesselation`. I'd also argue OVT is simple, fast, and lightweight enough that it's uncecessary to use a lower level language to utilize it.

I also want to bring up an interesting tidbit I discovered when studying pmtiles: You can use gzip's inflate/deflate directly in the tile data and see a more efficiently sized output for a dramatically smaller size and complexity cost. The client size cost to handle the decompression is [`4.6 kB` (`2.29 kB` gzip compressed) via javascript](https://bundlejs.com/?q=fflate&treeshake=%5B%7B+decompressSync+%7D%5D) with a tile size improvement of gzip being demonstrated above. I brought up in the last section that performance isn't a serious issue, so you could honestly use gzip directly in the tile data and get even better results then all 3 specs.

### Blunt Thoughts on what would Drastically Improve Maplibre's Spec with little Effort

After studying Maplibre's spec I want to honestly say I think it has a ton of potential but that I'm not yet convinced its the correct step forward for vector tiles. However, I do want to add some things I think would help move it forward:

#### Dependency Management

I am a firm believer that projects should avoid dependencies as much as possible, more-so in specification modules. I'd argue if MLT cleans up it's need for external dependencies, it would not only drastically reduce it's size complexity but also improve it's maintenance, ease of use, and adoptability.

As of writing I will explain the current dependencies and how they could be removed/replaced:

* `@bufbuild/protobuf` - this has a weight of [`33.7 kB`](https://bundlejs.com/?q=%40bufbuild%2Fprotobuf&treeshake=%5B%7B+Message%2Cproto3+%7D%5D) in the spec. The java implementation seems to write the components utilized by hand, so I believe the JS implementation could do the same and be smaller and simpler.
* `@types/bytebuffer` - this isn't actually a dependency, its a type definition (dev dependency)
* `bitset` - Can be replaced by a `Uint8Array` or `DataView`.
* `bytebuffer` - This is an outdated/redundant module that's replaced by a `DataView` which works in all local tools (nodeJS, Deno, Bun) as well as in the [browser](https://caniuse.com/?search=DataView). What's more is it singlehandedly acts as [`52.5kB`](https://bundlejs.com/?q=bytebuffer&treeshake=%5B*%5D) of the cost of the spec.
* `@mapbox/point-geometry` not shown as of yet, but used as a dependency. I'm not sure why this is necessary. Its a JS module (not TS), If you check the repository it's a simple class object that has a `x` and `y` properties with added functions. I don't see where the functions are used, or why the Point class couldn't be created locally.

I know this focuses on JS primarily, but I think the same ideology should be applied to all languages. Specifications (I argue) should be written to be simple and self-contained if possible. This topic sound almost nit-picky, but I disagree. I think an easy to read codebase goes a long way in peoples perception of your work and it's adoptability.

#### Compression Tools

I believe that dropping SIMD support would actually be a net win for MLTs. I argue that SIMD is useful for large swathes of data, but the majority use case for vector tiles is that they are small slices of a bigger story. They are designed to be minimal chunks of data, so you don't have much room to squeeze out the value of SIMD. When you look at the sheer size of the [fastpfor algorithm](https://github.com/maplibre/maplibre-tile-spec/blob/02183c872629ca41216ea171b7446efac34abd32/js/src/encodings/fastpfor/bitpacking.ts#L2926), you're looking at minimal gains for a huge cost in complexity and size. I can only imagine the cost it's adding to the java (and eventually rust) implementations as well (also SIMD support from Rust **sucks**, has Maplibre considered this yet?).

From the rest of my discussion on the topic as a whole, you already can tell I think too much added for compression is a net negative for the spec. While some aspects are a huge win and really impressive feats of engineering done by the MLT team, I'm not convinced all are worth their weight.

### Final Thoughts

I want to re-iterate that fundamentally, vector geometry specs are simply storage tools for two components: geometries and attributes. My primary argument throughout this document is that specifications can be kept simple, with minimal complexity, plenty of features, and no external dependencies. I think the next era of vector specs **should** expand on features, but maintain the simplicity and values of the giants who came before.

To be incredibly blunt, I think Maplibre's current spec needs work. I think after some evaluation and review, a second iteration of the spec could easily outperform my current iteration in all categories. I know that I probably sound crass for saying these things, but I think it's an important discussion to be had now before the spec is set in stone and ready for use. PMTiles is currently on its third iteration. I think it's vastly better than the first one. I'm on my third iteration myself with OVT, and I still think it could use tuning. My point isn't to deminish what MLT has achieved, but rather want to be clear in my narrative, that arguably there is still work to be done and hope they are willing to keep at it. I would love to see the project succeed and grow, but currently I think OVT is the better solution for `s2maps-gpu`.
