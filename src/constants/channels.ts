const DEV_CHANNELS = {
    STAFF: '1400004970664689798'
}

const PROD_CHANNELS = {
    STAFF: '1289416349860368425'
}

export default process.env.NODE_ENV === "development" ? DEV_CHANNELS : PROD_CHANNELS;