{/* PROJECTION */}
<section>
  <h3 className="font-bold text-emerald-400">
    Projection Confidence
  </h3>

  <p className="mt-1">
    Shows how much agreement exists between
    projection systems. Confidence measures
    reliability of the projection, not player talent.
  </p>

  <ul className="ml-4 mt-2 list-disc">
    <li>
      <strong className="text-emerald-400">
        HIGH
      </strong>{" "}
      = multiple sources strongly agree
      <span className="text-zinc-500">
        {" "}
        (variance ≤ 5)
      </span>
    </li>

    <li>
      <strong className="text-yellow-400">
        MEDIUM
      </strong>{" "}
      = moderate disagreement between sources
      <span className="text-zinc-500">
        {" "}
        (variance 5–15)
      </span>
    </li>

    <li>
      <strong className="text-red-400">
        LOW
      </strong>{" "}
      = single source or large disagreement
      <span className="text-zinc-500">
        {" "}
        (variance &gt; 15)
      </span>
    </li>
  </ul>


  <div className="mt-3">
    <strong className="text-zinc-300">
      Projection Sources
    </strong>

    <p>
      Number of projection models contributing
      to the player's projection.
    </p>

    <p className="text-zinc-500">
      Example: 3 sources means three projection
      systems agree on the player's expected output.
    </p>
  </div>


  <div className="mt-3">
    <strong className="text-zinc-300">
      Variance
    </strong>

    <p>
      Measures how far apart projection sources
      are from each other.
    </p>

    <p className="text-zinc-500">
      Lower variance = stronger agreement.
      Higher variance = more uncertainty.
    </p>

    <p className="mt-2 text-zinc-500">
      Example:
      Variance 2 means projection sources are
      typically within about 2 points of each other.
    </p>
  </div>


  <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
    <strong className="text-zinc-300">
      Important:
    </strong>

    <p className="mt-1 text-zinc-500">
      LOW confidence does not mean a bad player.
      It means the projection has less certainty.
      A superstar with one source will still show LOW.
    </p>
  </div>
</section>